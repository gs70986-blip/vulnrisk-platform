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


def extract_evidence(text_description, processed_text):
    """
    通用的证据提取步骤
    统计安全关键词、上下文线索和技术证据模式
    
    Returns:
        (security_keyword_count, context_cue_count, technical_evidence_count)
    """
    text_lower = processed_text.lower()
    text_original_lower = text_description.lower() if text_description else text_lower
    
    # 安全关键词
    security_keywords = [
        'xss', 'cross site scripting', 'sqli', 'sql injection', 'csrf', 'ssrf',
        'rce', 'remote code execution', 'code execution', 'command injection',
        'buffer overflow', 'stack overflow', 'heap overflow', 'integer overflow',
        'path traversal', 'directory traversal', 'file traversal',
        'deserialization', 'unsafe deserialization', 'xxe', 'xml external entity',
        'ldap injection', 'xpath injection', 'template injection', 'ssti',
        'authentication bypass', 'authorization bypass', 'privilege escalation',
        'information disclosure', 'data leak', 'credential leak', 'token theft',
        'open redirect', 'clickjacking', 'session fixation', 'session hijacking',
        'cors misconfiguration', 'jwt', 'hardcoded secret', 'secret leak',
        'race condition', 'time of check time of use', 'toctou',
        'insecure direct object reference', 'idor',
    ]
    
    # 上下文线索（exploit/attack/impact cues）
    context_cues = [
        'exploit', 'exploitable', 'exploitation', 'attacker', 'attack', 'attacking',
        'remote', 'remotely', 'arbitrary', 'arbitrarily', 'execute', 'execution',
        'payload', 'malicious', 'maliciously', 'bypass', 'bypassed', 'bypassing',
        'unauthorized', 'unauthorized access', 'privilege', 'privileges',
        'escalation', 'escalate', 'leak', 'leaked', 'leaking', 'disclosure',
        'crash', 'crashes', 'crashed', 'dos', 'denial of service', 'ddos',
        'code execution', 'command execution', 'arbitrary code', 'arbitrary command',
        'impact', 'impacts', 'affected', 'affects', 'vulnerable', 'vulnerability',
        'compromise', 'compromised', 'compromising', 'breach', 'breached',
        'injection', 'inject', 'injected', 'injecting',
    ]
    
    # 技术证据模式
    import re
    technical_evidence_patterns = [
        # CVE IDs
        r'\bcve-\d{4}-\d{4,}',
        # Version numbers
        r'\b\d+\.\d+(\.\d+)?',
        # Product/component names (common patterns)
        r'\b(apache|nginx|mysql|postgresql|redis|mongodb|elasticsearch|kafka|docker|kubernetes|openssl|libssl|curl|wget|git|svn|mercurial)\b',
        # Stack traces indicators
        r'(traceback|stack trace|exception|error at|at \w+\.\w+\(|line \d+)',
        # Error codes
        r'\b(error|err|exception|fail|failed|failure)\s*[:\-]?\s*\d+',
        # Code-like tokens
        r'[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)',  # function calls
        r'[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^=]',  # assignments
        # File paths
        r'[/\\][a-zA-Z0-9_/\\\.]+',
        # URLs
        r'https?://[^\s]+',
        # PoC indicators
        r'(poc|proof of concept|proof-of-concept|reproduce|reproduction|reproducible)',
        # Affected component words
        r'\b(component|module|library|package|dependency|plugin|extension|service|daemon|process)\b',
    ]
    
    # 统计安全关键词
    security_keyword_count = 0
    for keyword in security_keywords:
        if keyword in text_lower:
            security_keyword_count += 1
    
    # 统计上下文线索
    context_cue_count = 0
    for cue in context_cues:
        if cue in text_lower:
            context_cue_count += 1
    
    # 统计技术证据模式
    technical_evidence_count = 0
    for pattern in technical_evidence_patterns:
        if re.search(pattern, text_original_lower, re.IGNORECASE):
            technical_evidence_count += 1
    
    return security_keyword_count, context_cue_count, technical_evidence_count


def check_input_quality(text_description, processed_text):
    """
    输入质量检查（precheck）
    保守地检测明显非信息性输入，使用通用的证据充分性检查
    
    Returns:
        (is_low_quality, reason, note)
    """
    # 检查1: 文本过短
    if len(processed_text.strip()) < 15:
        return True, 'TOO_SHORT', 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
    
    # 检查2: 高度重复的文本（如 "hello hello hello"）
    words = processed_text.split()
    if len(words) > 0:
        unique_words = len(set(words))
        if unique_words < 3 and len(words) > 5:
            return True, 'HIGHLY_REPETITIVE', 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
    
    # 检查3: 问候语或闲聊模式
    greeting_patterns = ['hello', 'hi', 'nice to meet', 'good day', 'how are you', 'thank you', 'thanks']
    text_lower = processed_text.lower()
    greeting_count = sum(1 for pattern in greeting_patterns if pattern in text_lower)
    if greeting_count >= 2 and len(words) < 20:
        return True, 'GREETING_LIKE', 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
    
    # 检查4: 无意义的字符重复（如 "aaaaa" 或 "12345"）
    if len(processed_text) > 10:
        char_counts = {}
        for char in processed_text:
            if char.isalnum():
                char_counts[char] = char_counts.get(char, 0) + 1
        if char_counts:
            max_char_count = max(char_counts.values())
            if max_char_count > len(processed_text) * 0.5:
                return True, 'CHARACTER_REPETITION', 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
    
    # 检查5: 证据充分性检查（通用、内容无关）
    security_keyword_count, context_cue_count, technical_evidence_count = extract_evidence(text_description, processed_text)
    
    # 如果检测到安全关键词，但上下文线索和技术证据不足，保守跳过
    # 阈值：至少需要1个上下文线索或1个技术证据模式
    min_context_threshold = 1
    total_evidence = context_cue_count + technical_evidence_count
    
    if security_keyword_count > 0 and total_evidence < min_context_threshold:
        return True, 'INSUFFICIENT_EVIDENCE', (
            'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage. '
            f'(Security keywords: {security_keyword_count}, Context cues: {context_cue_count}, Technical evidence: {technical_evidence_count})'
        )
    
    return False, None, None


def detect_patch_mitigation_text(text_description, processed_text):
    """
    检测补丁/缓解风格的文本
    
    Returns:
        (is_patch_mitigation, confidence)
    """
    patch_keywords = [
        'fix', 'fixed', 'patch', 'patched', 'mitigation', 'mitigate', 'prevent',
        'sanitize', 'sanitization', 'escape', 'escaping', 'validate', 'validation',
        'secure', 'hardening', 'defense', 'protect', 'protection', 'block',
        'reject', 'filter', 'whitelist', 'blacklist', 'allowlist', 'denylist'
    ]
    
    text_lower = processed_text.lower()
    patch_count = sum(1 for keyword in patch_keywords if keyword in text_lower)
    
    # 如果包含多个补丁关键词，且文本长度合理，认为是补丁/缓解文本
    if patch_count >= 2:
        return True, min(1.0, patch_count / 5.0)  # 置信度基于关键词数量
    
    # 检查是否以 "Fix:" 或类似开头
    if text_lower.startswith(('fix:', 'fix ', 'patch:', 'patch ')):
        return True, 0.8
    
    return False, 0.0


def assess_prediction_uncertainty(severity_probs):
    """
    评估预测不确定性
    使用top-1和top-2概率差距以及熵来评估
    
    Returns:
        (is_uncertain, uncertainty_level, uncertainty_reason)
    """
    if severity_probs is None or len(severity_probs) != 4:
        return False, 0.0, None
    
    import math
    import numpy as np
    
    # 获取top-1和top-2概率
    sorted_probs = sorted(severity_probs, reverse=True)
    top1_prob = sorted_probs[0]
    top2_prob = sorted_probs[1]
    margin = top1_prob - top2_prob
    
    # 检查1: top-1和top-2概率太接近（margin太小）
    # 如果差距小于0.15，认为不确定
    min_margin_threshold = 0.15
    if margin < min_margin_threshold:
        uncertainty_level = 1.0 - margin
        return True, uncertainty_level, f'Top-1 and top-2 probabilities are too close (margin={margin:.3f} < {min_margin_threshold})'
    
    # 检查2: 计算概率分布的熵（不确定性指标）
    entropy = -sum(p * math.log(p + 1e-10) for p in severity_probs if p > 0)
    max_entropy = math.log(4)  # 最大熵（均匀分布）
    normalized_entropy = entropy / max_entropy
    
    # 如果熵很高（接近均匀分布），认为不确定
    if normalized_entropy > 0.85:
        return True, normalized_entropy, f'Probability distribution is relatively flat (entropy={normalized_entropy:.3f})'
    
    # 检查3: 最大概率是否足够高（没有明显优势类别）
    if top1_prob < 0.4:
        uncertainty_level = 1.0 - top1_prob
        return True, uncertainty_level, f'No dominant class (max probability={top1_prob:.3f} < 0.4)'
    
    return False, 0.0, None


def downgrade_reliability(current_reliability, reason='UNCERTAINTY'):
    """
    降级可靠性等级
    
    Args:
        current_reliability: 当前可靠性 ('High', 'Medium', 'Low')
        reason: 降级原因
    
    Returns:
        降级后的可靠性
    """
    if current_reliability == 'High':
        return 'Medium'
    elif current_reliability == 'Medium':
        return 'Low'
    else:
        return 'Low'  # 已经是Low，不再降级


def predict_two_stage(text_description, app_model_path=None, sev_model_path=None, 
                       app_threshold=0.5, use_legacy=False, legacy_model_path=None):
    """
    两阶段预测函数
    
    Stage A: Applicability 模型判断是否漏洞相关
    Stage B: Severity 模型预测严重度（4类）
    
    Args:
        text_description: 输入文本
        app_model_path: Applicability模型路径（默认: /app/models/app_model_001）
        sev_model_path: Severity模型路径（默认: /app/models/sev_model_001）
        app_threshold: Applicability阈值（默认: 0.5）
        use_legacy: 是否使用旧模型（向后兼容）
        legacy_model_path: 旧模型路径
    
    Returns:
        预测结果字典
    """
    # 预处理文本
    processed_text = preprocess_text_for_prediction(text_description)
    
    # ========== 输入质量检查（precheck）==========
    is_low_quality, quality_reason, quality_note = check_input_quality(text_description, processed_text)
    if is_low_quality:
        return {
            'applicable': False,
            'pApplicable': 0.0,
            'severityLevel': None,
            'severityProbs': None,
            'riskScore': 0,
            'pVuln': None,
            'riskLevel': 'Unknown',
            'explanation': quality_note,
            'reason': 'NOT_VULNERABILITY_TEXT',  # 统一使用NOT_VULNERABILITY_TEXT
            'text_len': len(processed_text),
            'reliability': 'Low',
            'notes': [quality_note],
            'inputType': 'low_quality',
        }
    
    if use_legacy and legacy_model_path:
        # 使用旧模型（向后兼容）
        return predict_legacy(text_description, legacy_model_path)
    
    # 默认模型路径（优先使用增强版本，如果不存在则回退到旧版本）
    if app_model_path is None:
        # 尝试使用增强版本（app_model_002_aug_xgb）
        potential_paths = [
            os.path.join(MODELS_DIR, 'app_model_002_aug_xgb'),  # 优先使用XGBoost增强版本
            os.path.join(MODELS_DIR, 'app_model_002_aug_rf'),
            os.path.join(MODELS_DIR, 'app_model_002_aug_lr'),
            os.path.join(MODELS_DIR, 'app_model_001'),  # 回退到旧版本
        ]
        app_model_path = None
        for path in potential_paths:
            if os.path.exists(path):
                app_model_path = path
                break
        if app_model_path is None:
            app_model_path = os.path.join(MODELS_DIR, 'app_model_001')  # 默认回退
    
    if sev_model_path is None:
        sev_model_path = os.path.join(MODELS_DIR, 'sev_model_001')
    
    # 加载Applicability模型
    try:
        app_model, app_vectorizer, app_metadata = load_model_artifacts(app_model_path)
        app_threshold = app_metadata.get('app_threshold', app_threshold)
    except FileNotFoundError:
        # 如果Applicability模型不存在，使用旧逻辑
        print(f"警告: Applicability模型不存在 ({app_model_path})，使用旧逻辑")
        if legacy_model_path:
            return predict_legacy(text_description, legacy_model_path)
        else:
            # 默认认为适用
            p_applicable = 0.8
            applicable = True
    else:
        # Stage A: 计算 pApplicable
        X_app = app_vectorizer.transform([processed_text])
        p_applicable = app_model.predict_proba(X_app)[0, 1]
        applicable = p_applicable >= app_threshold
    
    # Stage A decision: if not applicable, return early without Stage B
    if not applicable:
        return {
            'applicable': False,
            'pApplicable': float(p_applicable),
            'severityLevel': None,
            'severityProbs': None,
            'riskScore': 0,
            'pVuln': None,  # 兼容字段
            'riskLevel': 'Unknown',  # 使用"Unknown"而不是"N/A"
            'explanation': 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.',
            'reason': 'NOT_VULNERABILITY_TEXT',
            'text_len': len(processed_text),
            'reliability': 'Low',
            'notes': ['This input text was not identified as vulnerability-related based on applicability analysis and therefore did not enter the risk assessment stage.'],
            'inputType': 'normal',
        }
    
    # ========== Stage A后证据充分性检查（保守门控）==========
    # 即使Stage A通过，如果证据不足，保守跳过Stage B
    # 这是Stage A的一部分，用于确保只有真正漏洞相关的文本进入Stage B
    security_keyword_count, context_cue_count, technical_evidence_count = extract_evidence(text_description, processed_text)
    min_context_threshold = 1
    total_evidence = context_cue_count + technical_evidence_count
    
    # 如果检测到安全关键词但上下文线索和技术证据不足，保守跳过
    if security_keyword_count > 0 and total_evidence < min_context_threshold:
        return {
            'applicable': False,
            'pApplicable': float(p_applicable),
            'severityLevel': None,
            'severityProbs': None,
            'riskScore': 0,
            'pVuln': None,
            'riskLevel': 'Unknown',
            'explanation': 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.',
            'reason': 'NOT_VULNERABILITY_TEXT',
            'text_len': len(processed_text),
            'reliability': 'Low',
            'notes': [
                'This input text was not identified as vulnerability-related based on applicability analysis and therefore did not enter the risk assessment stage. '
                f'(Security keywords: {security_keyword_count}, Context cues: {context_cue_count}, Technical evidence: {technical_evidence_count})'
            ],
            'inputType': 'normal',
        }
    
    # Stage B: 计算严重度
    try:
        sev_model, sev_vectorizer, sev_metadata = load_model_artifacts(sev_model_path)
    except FileNotFoundError:
        # 如果Severity模型不存在，使用旧逻辑
        print(f"警告: Severity模型不存在 ({sev_model_path})，使用旧逻辑")
        if legacy_model_path:
            return predict_legacy(text_description, legacy_model_path)
        else:
            # 默认返回Medium（Severity模型不可用时的后备）
            return {
                'applicable': True,
                'pApplicable': float(p_applicable),
                'severityLevel': 'Medium',
                'severityProbs': {
                    'Low': 0.25,
                    'Medium': 0.25,
                    'High': 0.25,
                    'Critical': 0.25,
                },
                'riskScore': 0.5,
                'pVuln': 0.5,  # 兼容字段
                'riskLevel': 'Medium',  # 兼容字段
                'explanation': 'This input text was identified as vulnerability-related. A conditional risk assessment was performed based on learned vulnerability patterns. Predicted severity tendency: Medium. The risk score reflects a reference estimate under uncertainty. Due to limited or ambiguous evidence, the assessment confidence is low and results should be interpreted as reference only.',
                'reason': 'MODEL_NOT_FOUND',
                'reliability': 'Low',
                'notes': ['Severity model not available, using default predictions.'],
                'inputType': 'normal',
            }
    
    # 计算4类概率
    X_sev = sev_vectorizer.transform([processed_text])
    severity_probs_array = sev_model.predict_proba(X_sev)[0]  # [P(Low), P(Medium), P(High), P(Critical)]
    severity_probs = {
        'Low': float(severity_probs_array[0]),
        'Medium': float(severity_probs_array[1]),
        'High': float(severity_probs_array[2]),
        'Critical': float(severity_probs_array[3]),
    }
    
    # 映射到严重度等级
    severity_levels = ['Low', 'Medium', 'High', 'Critical']
    severity_level = severity_levels[np.argmax(severity_probs_array)]
    
    # 计算风险评分（期望加权）
    risk_score = (
        0.1 * severity_probs_array[0] +  # Low
        0.4 * severity_probs_array[1] +  # Medium
        0.7 * severity_probs_array[2] +  # High
        0.9 * severity_probs_array[3]     # Critical
    )
    
    # 计算pVuln（兼容字段）：P(High) + P(Critical)
    p_vuln = float(severity_probs_array[2] + severity_probs_array[3])
    
    # ========== 补丁/缓解文本检测 ==========
    is_patch_mitigation, patch_confidence = detect_patch_mitigation_text(text_description, processed_text)
    input_type = 'patch_mitigation' if is_patch_mitigation else 'normal'
    
    # ========== 不确定性评估和可靠性降级 ==========
    reliability = 'Medium'  # 默认可靠性
    notes = []
    
    # 评估预测不确定性
    is_uncertain, uncertainty_level, uncertainty_reason = assess_prediction_uncertainty(severity_probs_array)
    if is_uncertain:
        reliability = downgrade_reliability(reliability, 'UNCERTAINTY')
        notes.append(
            f"Prediction uncertainty is high (uncertainty level={uncertainty_level:.2f}). "
            f"{uncertainty_reason}. Results should be interpreted with caution."
        )
    
    # 如果检测到补丁/缓解文本，降级可靠性并添加说明
    if is_patch_mitigation:
        reliability = downgrade_reliability(reliability, 'PATCH_MITIGATION')
        notes.append(
            f"This text appears to describe remediation or mitigation measures rather than a vulnerability disclosure. "
            f"Interpret the risk assessment conservatively, as the text likely describes defensive measures."
        )
    
    # 生成解释（标准化格式）
    explanation = "This input text was identified as vulnerability-related. A conditional risk assessment was performed based on learned vulnerability patterns."
    
    # 如果严重度可用，追加严重度信息
    if severity_level:
        explanation += f" Predicted severity tendency: {severity_level}. The risk score reflects a reference estimate under uncertainty."
    
    # 如果可靠性低，追加说明
    if reliability == 'Low':
        explanation += " Due to limited or ambiguous evidence, the assessment confidence is low and results should be interpreted as reference only."
    
    # 特征统计
    nonzero_features = X_sev.getnnz()
    total_features = X_sev.shape[1]
    feature_coverage = nonzero_features / max(total_features, 1.0)
    
    # 提取模型路径名称
    def extract_model_name(model_path):
        if not model_path:
            return 'default'
        parts = model_path.split('/')
        return parts[-1] if parts else 'default'
    
    return {
        'applicable': True,
        'pApplicable': float(p_applicable),
        'severityLevel': severity_level,
        'severityProbs': severity_probs,
        'riskScore': float(risk_score),
        'pVuln': p_vuln,  # 兼容字段
        'riskLevel': severity_level,  # 兼容字段
        'explanation': explanation,
        'reason': 'APPLICABLE',
        'text_len': len(processed_text),
        'feature_coverage': float(feature_coverage),
        'nonzero_features': int(nonzero_features),
        'reliability': reliability,
        'notes': notes if notes else None,
        'inputType': input_type,
        'modelInfo': {
            'applicabilityModel': extract_model_name(app_model_path),
            'severityModel': extract_model_name(sev_model_path),
        },
    }


def predict_legacy(text_description, model_path):
    """
    旧版预测逻辑（向后兼容）
    """
    # 这里可以调用原来的predict函数逻辑
    # 为了简化，我们直接返回一个基本结果
    return {
        'applicable': True,
        'pApplicable': 0.8,
        'severityLevel': 'Medium',
        'severityProbs': None,
        'riskScore': 0.5,
        'pVuln': 0.5,
        'riskLevel': 'Medium',
        'explanation': 'Using legacy model (two-stage models not available).',
        'reason': 'LEGACY_MODEL',
    }


@app.route('/predict', methods=['POST'])
def predict():
    """
    单样本预测端点（两阶段推理）
    
    请求体:
    {
        "model_path": "/app/models/risk_model_001",  # 旧模型路径（向后兼容）
        "app_model_path": "/app/models/app_model_001",  # Applicability模型路径（可选）
        "sev_model_path": "/app/models/sev_model_001",  # Severity模型路径（可选）
        "app_threshold": 0.5,  # Applicability阈值（可选）
        "sample": {
            "sample_id": "sample_1",
            "text_description": "漏洞描述文本",
            "cvss_base_score": 7.5  # 可选（保留兼容）
        }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        sample = data.get('sample', {})
        text_description = sample.get('text_description', '')
        if not text_description:
            return jsonify({'error': 'text_description is required'}), 400
        
        # 获取模型路径
        app_model_path = data.get('app_model_path')
        sev_model_path = data.get('sev_model_path')
        legacy_model_path = data.get('model_path')  # 旧字段，向后兼容
        app_threshold = data.get('app_threshold', 0.5)
        legacy_mode = data.get('legacy_mode', False)  # 明确指定才走 legacy
        
        # 强制使用两阶段模型（除非明确指定 legacy_mode）
        if legacy_mode and legacy_model_path:
            # 仅当明确指定 legacy_mode=true 时才走旧流程
            if not legacy_model_path:
                legacy_model_path = os.path.join(MODELS_DIR, 'risk_model_001')
            
            # 加载旧模型
            model, vectorizer, metadata = load_model_artifacts(legacy_model_path)
            
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
            
            # 计算特征覆盖度
            nonzero_features = X.getnnz()
            total_features = X.shape[1]
            feature_coverage = nonzero_features / max(total_features, 1.0)
            feature_sum = X.sum()
            
            # 预测
            p_vuln_raw = model.predict_proba(X)[0, 1]
            p_vuln = p_vuln_raw
            
            # 获取或估算 CVSS
            cvss_base_score_input = sample.get('cvss_base_score')
            cvss_base_score = cvss_base_score_input
            cvss_estimated = False
            cvss_method = 'user_provided' if cvss_base_score_input else 'not_applicable'
            
            if cvss_base_score is None and training_data is not None:
                cvss_base_score_estimated, cvss_sim_meta = estimate_cvss_from_similarity(
                    processed_text, vectorizer, training_data, top_k=5, similarity_threshold=CVSS_SIM_THRESHOLD
                )
                if cvss_base_score_estimated is not None:
                    cvss_base_score = cvss_base_score_estimated
                    cvss_estimated = True
                    cvss_method = 'similarity'
            
            # 计算风险评分
            risk_score = calculate_risk_score(p_vuln, cvss_base_score, alpha=alpha)
            risk_level = get_risk_level(risk_score)
            
            # 构建返回结果（旧格式）
            result = {
                'sample_id': sample.get('sample_id', 'unknown'),
                'p_vuln': float(p_vuln),
                'p_vuln_raw': float(p_vuln_raw),
                'risk_score': float(risk_score) if risk_score is not None else None,
                'risk_level': risk_level,
                'cvss_base_score': float(cvss_base_score) if cvss_base_score is not None else None,
                'cvss_estimated': bool(cvss_estimated),
                'cvss_method': cvss_method,
                'applicable': True,
                'pApplicable': 0.8,  # 默认值
                'severityLevel': risk_level,
                'severityProbs': None,
                'explanation': f'Legacy model prediction. Risk level: {risk_level}.',
            }
        else:
            # 默认强制使用两阶段推理
            # 如果未指定路径，使用默认路径
            if app_model_path is None:
                # 尝试使用增强版本（app_model_002_aug_xgb）
                potential_paths = [
                    os.path.join(MODELS_DIR, 'app_model_002_aug_xgb'),
                    os.path.join(MODELS_DIR, 'app_model_002_aug_rf'),
                    os.path.join(MODELS_DIR, 'app_model_002_aug_lr'),
                    os.path.join(MODELS_DIR, 'app_model_001'),
                ]
                for path in potential_paths:
                    if os.path.exists(path):
                        app_model_path = path
                        break
            
            if sev_model_path is None:
                sev_model_path = os.path.join(MODELS_DIR, 'sev_model_001')
            
            # 使用两阶段推理
            result = predict_two_stage(
                text_description,
                app_model_path=app_model_path,
                sev_model_path=sev_model_path,
                app_threshold=app_threshold,
                use_legacy=False,
            )
        
        # 添加sample_id
        result['sample_id'] = sample.get('sample_id', 'unknown')
        
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
    批量预测端点（强制使用两阶段推理）
    
    请求体:
    {
        "app_model_path": "/app/models/app_model_002_aug_xgb",  # 可选
        "sev_model_path": "/app/models/sev_model_001",  # 可选
        "app_threshold": 0.5,  # 可选
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
        
        samples = data.get('samples', [])
        app_model_path = data.get('app_model_path')
        sev_model_path = data.get('sev_model_path')
        app_threshold = data.get('app_threshold', 0.5)
        
        if not samples or not isinstance(samples, list):
            return jsonify({'error': 'samples must be a non-empty list'}), 400
        
        # 强制使用两阶段推理，不使用 legacy 流程
        # 如果未指定路径，使用默认路径
        if app_model_path is None:
            potential_paths = [
                os.path.join(MODELS_DIR, 'app_model_002_aug_xgb'),
                os.path.join(MODELS_DIR, 'app_model_002_aug_rf'),
                os.path.join(MODELS_DIR, 'app_model_002_aug_lr'),
                os.path.join(MODELS_DIR, 'app_model_001'),
            ]
            for path in potential_paths:
                if os.path.exists(path):
                    app_model_path = path
                    break
        
        if sev_model_path is None:
            sev_model_path = os.path.join(MODELS_DIR, 'sev_model_001')
        
        # 对每个样本调用两阶段预测
        predictions = []
        for sample in samples:
            text_description = sample.get('text_description', '')
            if not text_description:
                continue
            
            result = predict_two_stage(
                text_description,
                app_model_path=app_model_path,
                sev_model_path=sev_model_path,
                app_threshold=app_threshold,
                use_legacy=False,
            )
            
            # 添加 sample_id
            result['sample_id'] = sample.get('sample_id', 'unknown')
            predictions.append(result)
        
        return jsonify({'predictions': predictions})
    
    except Exception as e:
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        print(f"Batch prediction error: {error_msg}\n{traceback_str}")
        return jsonify({
            'error': error_msg,
            'traceback': traceback_str if app.debug else None
        }), 500


@app.route('/predict/batch/legacy', methods=['POST'])
def predict_batch_legacy():
    """
    批量预测端点（旧版，向后兼容）
    仅当明确需要 legacy 行为时使用
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
        
        # 加载模型（legacy）
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
            # 注意：此逻辑仅用于 legacy 批量预测，不影响两阶段预测的 applicable 判定
            # A) 文本过短或为空
            if len(processed_text.strip()) < MIN_TEXT_LENGTH:
                applicable = False
                gating_reason = 'NOT_VULNERABILITY_TEXT'  # 改为统一的原因
                risk_level = 'Unknown'
                risk_score = 0.0
                cvss_base_score = None
                cvss_estimated = False
                cvss_method = 'not_applicable'
                cvss_sim_meta = None
                explanation = 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
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
                # 注意：此逻辑仅用于 legacy 批量预测，不影响两阶段预测的 applicable 判定
                if cvss_base_score is None and cvss_sim_meta and cvss_sim_meta.get('reason') == 'LOW_SIMILARITY':
                    applicable = False
                    gating_reason = 'NOT_VULNERABILITY_TEXT'  # 改为统一的原因
                    risk_level = 'Unknown'
                    risk_score = 0.0
                    max_sim = cvss_sim_meta.get('max_similarity', 0.0)
                    explanation = 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
                # C) P(vuln) 很低（< 0.3）且 CVSS 不是用户提供的（即系统估算的）
                # 注意：此逻辑仅用于 legacy 批量预测，不影响两阶段预测的 applicable 判定
                # 在两阶段预测中，applicable 仅由 pApplicable 决定
                elif p_vuln < 0.3 and cvss_method != 'user_provided':
                    applicable = False
                    gating_reason = 'NOT_VULNERABILITY_TEXT'  # 改为统一的原因
                    risk_level = 'Unknown'
                    risk_score = 0.0
                    explanation = 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
                # D) P(vuln) 在不确定区间且无 CVSS
                # 注意：此逻辑仅用于 legacy 批量预测，不影响两阶段预测的 applicable 判定
                elif cvss_base_score is None and PVULN_UNCERTAIN_LOW <= p_vuln <= PVULN_UNCERTAIN_HIGH:
                    applicable = False
                    gating_reason = 'NOT_VULNERABILITY_TEXT'  # 改为统一的原因
                    risk_level = 'Unknown'
                    risk_score = 0.0
                    explanation = 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
                # E) 特征覆盖度极低且无安全关键词（强信号表明是无关文本）
                # 注意：此逻辑仅用于 legacy 批量预测，不影响两阶段预测的 applicable 判定
                elif feature_coverage < 0.01 and not has_security_keywords and cvss_base_score is None:
                    applicable = False
                    gating_reason = 'NOT_VULNERABILITY_TEXT'  # 改为统一的原因
                    risk_level = 'Unknown'
                    risk_score = 0.0
                    explanation = 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.'
                # 正常情况
                else:
                    # 计算风险评分（使用实际或估算的 CVSS）
                    risk_score = float(calculate_risk_score(p_vuln, cvss_base_score, alpha=alpha))
                    risk_level = get_risk_level(risk_score)
                    explanation = None
            
            # 构建返回结果（legacy 批量预测格式）
            # 注意：applicable=false 时，字段值必须符合两阶段预测规范
            result_item = {
                'sample_id': sample.get('sample_id', f'sample_{i}'),
                'text_description': sample.get('text_description', ''),
                'p_vuln': float(p_vuln),
                'p_vuln_raw': float(p_vuln_raw),
                'risk_score': float(risk_score) if applicable else 0.0,
                'risk_level': risk_level if applicable else 'Unknown',
                'cvss_base_score': float(cvss_base_score) if cvss_base_score is not None else None,
                'cvss_estimated': bool(cvss_estimated),
                'cvss_method': cvss_method,
                'feature_coverage': float(feature_coverage),
                'feature_sum': float(feature_sum),
                'has_security_keywords': bool(has_security_keywords),
                'confidence_adjustment': float(confidence_adjustment),
                # 两阶段字段（legacy 批量预测时，applicable=false 表示未通过门控）
                'applicable': bool(applicable),
                'pApplicable': None,  # legacy 流程不提供 pApplicable
                'severityLevel': None if not applicable else risk_level,
                'severityProbs': None if not applicable else None,  # legacy 不提供概率分布
                'explanation': explanation,
                'meta': {
                    'reason': gating_reason,
                    'max_similarity': cvss_sim_meta.get('max_similarity') if cvss_sim_meta else None,
                    'thresholds': {
                        'cvss_sim_threshold': float(CVSS_SIM_THRESHOLD),
                        'p_vuln_uncertain_low': float(PVULN_UNCERTAIN_LOW),
                        'p_vuln_uncertain_high': float(PVULN_UNCERTAIN_HIGH),
                        'min_text_length': int(MIN_TEXT_LENGTH)
                    }
                }
            }
            predictions.append(result_item)
        
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
