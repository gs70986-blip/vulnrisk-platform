"""
Flask API服务 - 漏洞风险预测ML服务
提供模型训练、预测和批量预测接口
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
from pathlib import Path

# 导入自定义模块
from risk import calculate_risk_score, get_risk_level, estimate_cvss_from_p_vuln, estimate_cvss_from_similarity, assess_applicability

app = Flask(__name__)
CORS(app)

# 环境变量配置
MODELS_DIR = os.getenv('MODELS_DIR', '/app/models')
DATA_DIR = os.getenv('DATA_DIR', '/app/data')
RISK_ALPHA = float(os.getenv('RISK_ALPHA', '0.6'))

# CVSS similarity threshold - below this, don't estimate CVSS to avoid false positives
CVSS_SIM_THRESHOLD = float(os.getenv('CVSS_SIM_THRESHOLD', '0.18'))

# P(vuln) uncertain interval - if p_vuln falls in this range and no CVSS, output "Uncertain"
PVULN_UNCERTAIN_LOW = float(os.getenv('PVULN_UNCERTAIN_LOW', '0.35'))
PVULN_UNCERTAIN_HIGH = float(os.getenv('PVULN_UNCERTAIN_HIGH', '0.65'))

# Minimum text length to be considered valid input
MIN_TEXT_LENGTH = int(os.getenv('MIN_TEXT_LENGTH', '20'))

# Business clipping configuration (工程裁剪)
CLIP_NA_ENABLED = os.getenv('CLIP_NA_ENABLED', 'true').lower() == 'true'
CLIP_PVULN_THRESHOLD = float(os.getenv('CLIP_PVULN_THRESHOLD', '0.10'))
CLIP_SIM_THRESHOLD = float(os.getenv('CLIP_SIM_THRESHOLD', '0.18'))
CLIP_MIN_TEXT_LEN = int(os.getenv('CLIP_MIN_TEXT_LEN', '20'))
CLIP_MIN_NONZERO_TFIDF = int(os.getenv('CLIP_MIN_NONZERO_TFIDF', '3'))


def resolve_model_dir(model_path):
    """
    解析模型目录路径，处理各种路径格式
    
    Args:
        model_path: 模型路径（可能是绝对路径、相对路径或Docker路径）
    
    Returns:
        model_dir: 解析后的模型目录路径
    """
    if not model_path:
        raise ValueError("model_path cannot be empty")
    
    # 如果路径存在，直接返回
    if os.path.exists(model_path):
        if os.path.isdir(model_path):
            return model_path
        elif os.path.isfile(model_path):
            return os.path.dirname(model_path)
        else:
            return model_path
    
    # 处理Docker路径格式
    if model_path.startswith('/app/models/'):
        # 已经是正确的Docker路径
        return model_path
    elif model_path.startswith('/app/ml-models/'):
        # 替代路径格式
        return model_path
    else:
        # 尝试在MODELS_DIR下查找
        potential_path = os.path.join(MODELS_DIR, model_path)
        if os.path.exists(potential_path):
            return potential_path if os.path.isdir(potential_path) else os.path.dirname(potential_path)
        else:
            # 尝试ml-models路径
            ml_models_path = os.path.join('/app/ml-models', model_path)
            if os.path.exists(ml_models_path):
                return ml_models_path if os.path.isdir(ml_models_path) else os.path.dirname(ml_models_path)
            else:
                # 如果都不存在，返回原始路径（让后续加载失败时给出明确错误）
                return model_path


def load_model_artifacts(model_dir):
    """
    加载模型和预处理器
    
    Args:
        model_dir: 模型目录路径
    
    Returns:
        model: 训练好的模型
        vectorizer: TF-IDF向量化器
        metadata: 模型元数据
    """
    model_dir = resolve_model_dir(model_dir)
    
    # 加载模型
    model_path = os.path.join(model_dir, 'model.joblib')
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
    model = joblib.load(model_path)
    
    # 加载向量化器
    vectorizer_path = os.path.join(model_dir, 'vectorizer.joblib')
    if not os.path.exists(vectorizer_path):
        raise FileNotFoundError(f"Vectorizer file not found: {vectorizer_path}")
    vectorizer = joblib.load(vectorizer_path)
    
    # 加载元数据（可选）
    metadata = {}
    metadata_path = os.path.join(model_dir, 'metadata.json')
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
    
    return model, vectorizer, metadata


def load_training_data(dataset_path):
    """
    加载训练数据集，用于 CVSS 相似度估算
    
    Args:
        dataset_path: 训练数据集路径
    
    Returns:
        training_data: 训练数据 DataFrame，包含 text_description 和 cvss_base_score
    """
    if not dataset_path or not os.path.exists(dataset_path):
        return None
    
    try:
        with open(dataset_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        df = pd.DataFrame(data)
        
        # 只返回有 CVSS 值的样本
        df_with_cvss = df[df['cvss_base_score'].notna()].copy()
        
        if len(df_with_cvss) == 0:
            return None
        
        return df_with_cvss
    except Exception as e:
        print(f"Warning: Failed to load training data from {dataset_path}: {e}")
        return None


def preprocess_text_for_prediction(text):
    """
    预处理文本（与训练时保持一致）
    
    Args:
        text: 原始文本
    
    Returns:
        processed_text: 处理后的文本
    """
    if pd.isna(text) or not text:
        return ""
    
    import re
    text_lower = str(text).lower()
    text_clean = re.sub(r'[^a-z0-9\s]', ' ', text_lower)
    text_clean = ' '.join(text_clean.split())
    return text_clean


@app.route('/health', methods=['GET'])
def health():
    """健康检查端点"""
    return jsonify({
        'status': 'healthy',
        'service': 'vulnrisk-ml-service',
        'models_dir': MODELS_DIR,
        'data_dir': DATA_DIR
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    单样本预测端点
    
    请求体:
    {
        "model_path": "/app/models/risk_model_001",
        "sample": {
            "sample_id": "sample_1",
            "text_description": "漏洞描述文本",
            "cvss_base_score": 7.5  # 可选
        }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        model_path = data.get('model_path')
        sample = data.get('sample', {})
        
        if not model_path:
            return jsonify({'error': 'model_path is required'}), 400
        
        text_description = sample.get('text_description', '')
        if not text_description:
            return jsonify({'error': 'text_description is required'}), 400
        
        # 加载模型
        model, vectorizer, metadata = load_model_artifacts(model_path)
        
        # 加载训练数据（用于 CVSS 相似度估算）
        training_data = None
        dataset_path = metadata.get('dataset_path') if metadata else None
        if dataset_path:
            training_data = load_training_data(dataset_path)
        
        # 获取alpha（从元数据或环境变量）
        alpha = metadata.get('params', {}).get('alpha', RISK_ALPHA) if metadata else RISK_ALPHA
        
        # 预处理文本
        processed_text = preprocess_text_for_prediction(text_description)
        
        # 特征提取
        X = vectorizer.transform([processed_text])
        
        # 计算特征覆盖度（非零特征占比）
        # 如果输入文本与训练数据差异很大，特征覆盖度会很低，需要保守处理
        nonzero_features = X.getnnz()  # 非零特征数量
        total_features = X.shape[1]    # 总特征数量
        feature_coverage = nonzero_features / max(total_features, 1.0)
        
        # 计算特征权重总和（TF-IDF值的总和），这更能反映文本与训练数据的相似度
        feature_sum = X.sum()
        max_possible_sum = 10.0  # 合理的上限，实际值取决于TF-IDF向量化器设置
        
        # 预测
        p_vuln_raw = model.predict_proba(X)[0, 1]
        
        # 安全检查：定义与漏洞相关的关键词（常见漏洞描述中会出现的词）
        # 如果文本中完全没有这些词，且特征覆盖度很低，应该保守处理
        vulnerability_keywords = {
            'vulnerability', 'vuln', 'security', 'exploit', 'attack', 'injection',
            'sql', 'xss', 'csrf', 'buffer', 'overflow', 'authentication', 'authorization',
            'privilege', 'escalation', 'traversal', 'disclosure', 'execution', 'bypass',
            'denial', 'service', 'dos', 'ddos', 'malicious', 'unauthorized', 'access',
            'exposure', 'leak', 'breach', 'penetration', 'intrusion', 'hack', 'crack'
        }
        text_words = set(processed_text.lower().split())
        has_security_keywords = bool(text_words & vulnerability_keywords)
        
        # 更严格的置信度调整
        confidence_adjustment = 1.0
        p_vuln = p_vuln_raw
        
        # 情况1：极低特征覆盖度（< 0.005）或文本极短（< 10字符）
        if feature_coverage < 0.005 or len(processed_text.strip()) < 10:
            confidence_adjustment = 0.1
            # 直接设置很低的上限，无论原始预测如何
            p_vuln = min(0.15, p_vuln_raw * 0.1)
        
        # 情况2：特征覆盖度很低且没有安全相关关键词
        elif feature_coverage < 0.02 and not has_security_keywords:
            confidence_adjustment = 0.2
            p_vuln = min(0.25, p_vuln_raw * 0.2)
        
        # 情况3：特征覆盖度低（< 0.05）且没有安全关键词
        elif feature_coverage < 0.05 and not has_security_keywords:
            confidence_adjustment = 0.4
            p_vuln = min(0.35, p_vuln_raw * 0.4)
        
        # 情况4：特征权重总和很小，说明文本与训练数据差异很大
        elif feature_sum < 0.1 and not has_security_keywords:
            confidence_adjustment = 0.3
            p_vuln = min(0.30, p_vuln_raw * 0.3)
        
        # 情况5：特征覆盖度低但有安全关键词，适度降低
        elif feature_coverage < 0.05:
            confidence_adjustment = 0.7
            p_vuln = p_vuln_raw * 0.7
        
        # 情况6：正常情况，使用原始预测
        else:
            p_vuln = p_vuln_raw
        
        # 获取或估算 CVSS 基础评分（在工程裁剪之前）
        cvss_base_score_input = sample.get('cvss_base_score')
        cvss_sim_meta = None
        cvss_base_score = None
        cvss_estimated = False
        cvss_method = 'not_applicable'
        
        if cvss_base_score_input is None or (isinstance(cvss_base_score_input, float) and np.isnan(cvss_base_score_input)):
            # 如果没有提供 CVSS，优先使用训练数据相似度估算
            cvss_base_score_estimated = None
            if training_data is not None:
                cvss_base_score_estimated, cvss_sim_meta = estimate_cvss_from_similarity(
                    processed_text, vectorizer, training_data, top_k=5, similarity_threshold=CVSS_SIM_THRESHOLD
                )
            
            # 如果相似度估算失败，使用 p_vuln 映射作为后备（但会被工程裁剪检查）
            if cvss_base_score_estimated is None:
                if cvss_sim_meta and cvss_sim_meta.get('reason') == 'LOW_SIMILARITY':
                    cvss_base_score = None
                    cvss_estimated = False
                    cvss_method = 'similarity_failed'
                else:
                    cvss_base_score_estimated = estimate_cvss_from_p_vuln(p_vuln)
                    cvss_base_score = cvss_base_score_estimated
                    cvss_estimated = True
                    cvss_method = 'p_vuln_fallback'
            else:
                cvss_base_score = cvss_base_score_estimated
                cvss_estimated = True
                cvss_method = 'similarity'
        else:
            cvss_base_score = cvss_base_score_input
            cvss_estimated = False
            cvss_method = 'user_provided'
        
        # ========== 工程裁剪（Business Clipping）：适用性判定 ==========
        tfidf_meta = {'nonzero_features': nonzero_features}
        applicability = assess_applicability(
            text=processed_text,
            p_vuln=p_vuln,
            similarity_meta=cvss_sim_meta,
            tfidf_meta=tfidf_meta,
            cvss_input=cvss_base_score_input,
            clip_na_enabled=CLIP_NA_ENABLED,
            clip_pvuln_threshold=CLIP_PVULN_THRESHOLD,
            clip_sim_threshold=CLIP_SIM_THRESHOLD,
            clip_min_text_len=CLIP_MIN_TEXT_LEN,
            clip_min_nonzero_tfidf=CLIP_MIN_NONZERO_TFIDF
        )
        
        # 根据适用性判定结果进行裁剪
        if not applicability['applicable'] and CLIP_NA_ENABLED:
            # 强制裁剪：置零并设置为 N/A
            p_vuln_clipped = p_vuln  # 保存裁剪前的值用于 explanation
            p_vuln = 0.0
            risk_score = 0.0
            risk_level = 'N/A'
            # 安全获取 debug 值
            debug_info = applicability.get('debug', {})
            max_sim = debug_info.get('max_similarity') if debug_info.get('max_similarity') is not None else 0.0
            nonzero_feat = debug_info.get('nonzero_features') if debug_info.get('nonzero_features') is not None else 0
            text_len_debug = debug_info.get('text_len', 0)
            
            explanation_map = {
                'EMPTY_TEXT': f'Input text too short ({text_len_debug} chars < {CLIP_MIN_TEXT_LEN} chars). Scoring not applicable.',
                'LOW_SIMILARITY': f'Input text has low similarity to vulnerability corpus (max similarity {max_sim:.3f} < {CLIP_SIM_THRESHOLD}). Scoring not applicable.',
                'LOW_SIGNAL': f'Input text has insufficient TF-IDF features ({nonzero_feat} < {CLIP_MIN_NONZERO_TFIDF}). Scoring not applicable.',
                'LOW_PVULN': f'Input text has very low vulnerability probability ({p_vuln_clipped:.3f} < {CLIP_PVULN_THRESHOLD}). Input text not vulnerability-related; scoring not applicable.'
            }
            explanation = explanation_map.get(applicability['reason'], 'Input text not vulnerability-related; scoring not applicable.')
            applicable = False
            gating_reason = applicability['reason']
        else:
            # 正常情况：计算风险评分
            risk_score = calculate_risk_score(p_vuln, cvss_base_score, alpha=alpha)
            risk_level = get_risk_level(risk_score)
            explanation = None
            applicable = True
            gating_reason = None
        
        # 构建返回结果
        result = {
            'sample_id': sample.get('sample_id', 'unknown'),
            'p_vuln': float(p_vuln),
            'p_vuln_raw': float(p_vuln_raw),  # 原始预测值，用于调试
            'risk_score': float(risk_score),
            'risk_level': risk_level,
            'cvss_base_score': float(cvss_base_score) if cvss_base_score is not None else None,
            'cvss_estimated': bool(cvss_estimated),  # 标记 CVSS 是否为估算值
            'cvss_method': cvss_method,  # CVSS 来源方法
            'feature_coverage': float(feature_coverage),  # 特征覆盖度，用于调试
            'feature_sum': float(feature_sum),  # 特征权重总和，用于调试
            'has_security_keywords': bool(has_security_keywords),  # 是否包含安全关键词
            'confidence_adjustment': float(confidence_adjustment),  # 置信度调整系数，用于调试
            # 工程裁剪相关信息
            'explanation': explanation,  # 解释信息（如果被裁剪）
            'meta': {
                'applicable': bool(applicable),
                'reason': gating_reason,  # 裁剪原因（如果 applicable=False）
                'max_similarity': applicability.get('debug', {}).get('max_similarity'),
                'nonzero_features': applicability.get('debug', {}).get('nonzero_features'),
                'text_len': applicability.get('debug', {}).get('text_len'),
                'thresholds': applicability.get('thresholds', {})
            }
        }
        
        return jsonify(result)
    
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        print(f"Prediction error: {error_msg}\n{traceback_str}")
        return jsonify({
            'error': error_msg,
            'traceback': traceback_str if app.debug else None
        }), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """
    批量预测端点
    
    请求体:
    {
        "model_path": "/app/models/risk_model_001",
        "samples": [
            {
                "sample_id": "sample_1",
                "text_description": "漏洞描述1",
                "cvss_base_score": 7.5
            },
            {
                "sample_id": "sample_2",
                "text_description": "漏洞描述2"
            }
        ]
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        model_path = data.get('model_path')
        samples = data.get('samples', [])
        
        if not model_path:
            return jsonify({'error': 'model_path is required'}), 400
        
        if not samples or not isinstance(samples, list):
            return jsonify({'error': 'samples must be a non-empty list'}), 400
        
        # 加载模型
        model, vectorizer, metadata = load_model_artifacts(model_path)
        
        # 加载训练数据（用于 CVSS 相似度估算）
        training_data = None
        dataset_path = metadata.get('dataset_path') if metadata else None
        if dataset_path:
            training_data = load_training_data(dataset_path)
        
        # 获取alpha
        alpha = metadata.get('params', {}).get('alpha', RISK_ALPHA) if metadata else RISK_ALPHA
        
        # 预处理所有文本
        processed_texts = [preprocess_text_for_prediction(s.get('text_description', '')) for s in samples]
        
        # 特征提取
        X = vectorizer.transform(processed_texts)
        
        # 批量预测
        p_vuln_array_raw = model.predict_proba(X)[:, 1]
        
        # 安全检查：定义与漏洞相关的关键词
        vulnerability_keywords = {
            'vulnerability', 'vuln', 'security', 'exploit', 'attack', 'injection',
            'sql', 'xss', 'csrf', 'buffer', 'overflow', 'authentication', 'authorization',
            'privilege', 'escalation', 'traversal', 'disclosure', 'execution', 'bypass',
            'denial', 'service', 'dos', 'ddos', 'malicious', 'unauthorized', 'access',
            'exposure', 'leak', 'breach', 'penetration', 'intrusion', 'hack', 'crack'
        }
        
        # 计算风险评分和等级（带置信度调整）
        predictions = []
        for i, sample in enumerate(samples):
            p_vuln_raw = float(p_vuln_array_raw[i])
            processed_text = processed_texts[i]
            
            # 计算特征覆盖度
            nonzero_features = X[i].getnnz()
            total_features = X.shape[1]
            feature_coverage = nonzero_features / max(total_features, 1.0)
            
            # 计算特征权重总和
            feature_sum = float(X[i].sum())
            
            # 检查是否包含安全关键词
            text_words = set(processed_text.lower().split())
            has_security_keywords = bool(text_words & vulnerability_keywords)
            
            # 置信度调整（与单次预测相同的逻辑）
            confidence_adjustment = 1.0
            p_vuln = p_vuln_raw
            
            # 情况1：极低特征覆盖度或文本极短
            if feature_coverage < 0.005 or len(processed_text.strip()) < 10:
                confidence_adjustment = 0.1
                p_vuln = min(0.15, p_vuln_raw * 0.1)
            # 情况2：特征覆盖度很低且没有安全关键词
            elif feature_coverage < 0.02 and not has_security_keywords:
                confidence_adjustment = 0.2
                p_vuln = min(0.25, p_vuln_raw * 0.2)
            # 情况3：特征覆盖度低且没有安全关键词
            elif feature_coverage < 0.05 and not has_security_keywords:
                confidence_adjustment = 0.4
                p_vuln = min(0.35, p_vuln_raw * 0.4)
            # 情况4：特征权重总和很小且没有安全关键词
            elif feature_sum < 0.1 and not has_security_keywords:
                confidence_adjustment = 0.3
                p_vuln = min(0.30, p_vuln_raw * 0.3)
            # 情况5：特征覆盖度低但有安全关键词
            elif feature_coverage < 0.05:
                confidence_adjustment = 0.7
                p_vuln = p_vuln_raw * 0.7
            # 情况6：正常情况
            else:
                p_vuln = p_vuln_raw
            
            # ========== 拒答机制：优先检查，避免无关文本被评分 ==========
            # A) 文本过短或为空
            if len(processed_text.strip()) < MIN_TEXT_LENGTH:
                applicable = False
                gating_reason = 'EMPTY_TEXT'
                risk_level = 'N/A'
                risk_score = 0.0
                cvss_base_score = None
                cvss_estimated = False
                cvss_method = 'not_applicable'
                cvss_sim_meta = None
                explanation = f'输入文本过短（{len(processed_text.strip())} 字符 < {MIN_TEXT_LENGTH} 字符），无法进行有效预测'
            else:
                # 获取或估算 CVSS 基础评分
                cvss_base_score_input = sample.get('cvss_base_score')
                cvss_sim_meta = None
                gating_reason = None
                applicable = True
                
                if cvss_base_score_input is None or (isinstance(cvss_base_score_input, float) and np.isnan(cvss_base_score_input)):
                    # 如果没有提供 CVSS，优先使用训练数据相似度估算
                    cvss_base_score_estimated = None
                    if training_data is not None:
                        cvss_base_score_estimated, cvss_sim_meta = estimate_cvss_from_similarity(
                            processed_text, vectorizer, training_data, top_k=5, similarity_threshold=CVSS_SIM_THRESHOLD
                        )
                    
                    # 如果相似度估算失败，检查是否因为相似度低（不应用后备方法）
                    if cvss_base_score_estimated is None:
                        if cvss_sim_meta and cvss_sim_meta.get('reason') == 'LOW_SIMILARITY':
                            # 相似度低，不使用 p_vuln 后备，而是标记为不可用
                            cvss_base_score = None
                            cvss_estimated = False
                            cvss_method = 'similarity_failed'
                        else:
                            # 其他原因（如无训练数据），检查 p_vuln 是否在不确定区间
                            # 如果 p_vuln 很低（< 0.3），可能是误报，也标记为不可用
                            if p_vuln < 0.3:
                                # p_vuln 很低，说明模型认为不是漏洞，不应该估算 CVSS
                                cvss_base_score = None
                                cvss_estimated = False
                                cvss_method = 'low_p_vuln'
                            else:
                                # 使用 p_vuln 映射作为后备（但仅当 p_vuln 较高时）
                                cvss_base_score_estimated = estimate_cvss_from_p_vuln(p_vuln)
                                cvss_base_score = cvss_base_score_estimated
                                cvss_estimated = True
                                cvss_method = 'p_vuln_fallback'
                    else:
                        cvss_base_score = cvss_base_score_estimated
                        cvss_estimated = True
                        cvss_method = 'similarity'
                else:
                    cvss_base_score = cvss_base_score_input
                    cvss_estimated = False
                    cvss_method = 'user_provided'
                
                # B) CVSS 相似度低且用户未提供 CVSS
                if cvss_base_score is None and cvss_sim_meta and cvss_sim_meta.get('reason') == 'LOW_SIMILARITY':
                    applicable = False
                    gating_reason = 'LOW_SIMILARITY'
                    risk_level = 'N/A'
                    risk_score = 0.0
                    max_sim = cvss_sim_meta.get('max_similarity', 0.0)
                    explanation = f'输入文本与训练数据相似度低（{max_sim:.3f} < {CVSS_SIM_THRESHOLD}），无法可靠估算风险'
                # C) P(vuln) 很低（< 0.3）且 CVSS 不是用户提供的（即系统估算的）
                # 如果模型认为漏洞概率很低，即使相似度够高估算出了 CVSS，也应该拒绝评分
                elif p_vuln < 0.3 and cvss_method != 'user_provided':
                    applicable = False
                    gating_reason = 'LOW_PVULN'
                    risk_level = 'N/A'
                    risk_score = 0.0
                    explanation = f'漏洞概率很低（{p_vuln:.3f} < 0.3），模型认为这不是漏洞，无法确定风险等级'
                # D) P(vuln) 在不确定区间且无 CVSS
                elif cvss_base_score is None and PVULN_UNCERTAIN_LOW <= p_vuln <= PVULN_UNCERTAIN_HIGH:
                    applicable = False
                    gating_reason = 'UNCERTAIN_PVULN'
                    risk_level = 'Uncertain'
                    risk_score = 0.0
                    explanation = f'漏洞概率在不确定区间（{p_vuln:.3f} 在 [{PVULN_UNCERTAIN_LOW}, {PVULN_UNCERTAIN_HIGH}]），且无 CVSS 信息，无法确定风险等级'
                # E) 特征覆盖度极低且无安全关键词（强信号表明是无关文本）
                elif feature_coverage < 0.01 and not has_security_keywords and cvss_base_score is None:
                    applicable = False
                    gating_reason = 'OOD'  # Out-of-Distribution
                    risk_level = 'N/A'
                    risk_score = 0.0
                    explanation = f'输入文本与训练数据差异极大（特征覆盖度 {feature_coverage:.4f} < 0.01），且无安全相关关键词，无法进行风险评估'
                # 正常情况
                else:
                    # 计算风险评分（使用实际或估算的 CVSS）
                    risk_score = float(calculate_risk_score(p_vuln, cvss_base_score, alpha=alpha))
                    risk_level = get_risk_level(risk_score)
                    explanation = None
            
            predictions.append({
                'sample_id': sample.get('sample_id', f'sample_{i}'),
                'text_description': sample.get('text_description', ''),
                'p_vuln': float(p_vuln),
                'p_vuln_raw': float(p_vuln_raw),
                'risk_score': float(risk_score),
                'risk_level': risk_level,
                'cvss_base_score': float(cvss_base_score) if cvss_base_score is not None else None,
                'cvss_estimated': bool(cvss_estimated),  # 标记 CVSS 是否为估算值
                'cvss_method': cvss_method,  # CVSS 来源方法
                'feature_coverage': float(feature_coverage),
                'feature_sum': float(feature_sum),
                'has_security_keywords': bool(has_security_keywords),
                'confidence_adjustment': float(confidence_adjustment),
                # 新增字段：拒答机制相关信息
                'applicable': bool(applicable),  # 是否适用于风险评分
                'explanation': explanation,  # 解释信息（如果不适用）
                'meta': {
                    'reason': gating_reason,  # 拒答原因（如果 applicable=False）
                    'max_similarity': cvss_sim_meta.get('max_similarity') if cvss_sim_meta else None,
                    'thresholds': {
                        'cvss_sim_threshold': float(CVSS_SIM_THRESHOLD),
                        'p_vuln_uncertain_low': float(PVULN_UNCERTAIN_LOW),
                        'p_vuln_uncertain_high': float(PVULN_UNCERTAIN_HIGH),
                        'min_text_length': int(MIN_TEXT_LENGTH)
                    }
                }
            })
        
        # 统计信息
        risk_levels = [p['risk_level'] for p in predictions]
        summary = {
            'total': len(predictions),
            'low': risk_levels.count('Low'),
            'medium': risk_levels.count('Medium'),
            'high': risk_levels.count('High'),
            'critical': risk_levels.count('Critical')
        }
        
        return jsonify({
            'predictions': predictions,
            'summary': summary
        })
    
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        print(f"Batch prediction error: {error_msg}\n{traceback_str}")
        return jsonify({
            'error': error_msg,
            'traceback': traceback_str if app.debug else None
        }), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    print(f"Starting ML Service on port {port}")
    print(f"Models directory: {MODELS_DIR}")
    print(f"Data directory: {DATA_DIR}")
    print(f"Risk alpha: {RISK_ALPHA}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
