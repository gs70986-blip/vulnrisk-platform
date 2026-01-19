"""
风险评分计算模块
实现基于P(vuln)和CVSS的风险评分公式
"""

import numpy as np
import os


def calculate_risk_score(p_vuln, cvss_base_score=None, alpha=0.6):
    """
    计算风险评分
    
    公式: RiskScore = α * P(vuln) + (1 - α) * CVSS_norm
    其中 CVSS_norm = CVSS_base / 10.0
    
    Args:
        p_vuln: 模型预测的高风险漏洞概率 [0, 1]
        cvss_base_score: CVSS基础评分 [0, 10]，可选
        alpha: 权重参数，默认0.6
    
    Returns:
        risk_score: 风险评分 [0, 1]
    """
    # 确保P(vuln)在[0, 1]范围内
    p = max(0.0, min(1.0, p_vuln))
    
    # 如果有CVSS评分，则使用加权公式
    if cvss_base_score is not None and not (isinstance(cvss_base_score, float) and np.isnan(cvss_base_score)):
        # 归一化CVSS评分到[0, 1]
        c = max(0.0, min(10.0, float(cvss_base_score))) / 10.0
        # 计算加权风险评分
        risk = alpha * p + (1.0 - alpha) * c
    else:
        # 如果没有CVSS评分，直接使用P(vuln)
        risk = p
    
    # 确保结果在[0, 1]范围内
    return max(0.0, min(1.0, risk))


def get_risk_level(risk_score):
    """
    根据风险评分映射到风险等级
    
    Args:
        risk_score: 风险评分 [0, 1]
    
    Returns:
        risk_level: 风险等级字符串 ("Low", "Medium", "High", "Critical")
    """
    if risk_score < 0.4:
        return "Low"
    elif risk_score < 0.6:
        return "Medium"
    elif risk_score < 0.8:
        return "High"
    else:
        return "Critical"


def estimate_cvss_from_similarity(processed_text, vectorizer, training_data, top_k=5, similarity_threshold=0.18):
    """
    基于训练数据文本相似度估算 CVSS 基础评分
    
    使用 TF-IDF 向量相似度找到最相似的训练样本，然后对这些样本的 CVSS 值
    进行加权平均（权重为相似度）。
    
    如果最大相似度低于阈值，返回 None 以避免无关文本被错误匹配到高 CVSS 样本。
    
    Args:
        processed_text: 预处理后的文本
        vectorizer: TF-IDF 向量化器
        training_data: 训练数据 DataFrame，必须包含 text_description 和 cvss_base_score
        top_k: 使用最相似的 top_k 个样本（默认 5）
        similarity_threshold: 最大相似度阈值，低于此值不估算 CVSS（默认 0.18）
    
    Returns:
        tuple: (cvss_base_score, meta_dict)
            - cvss_base_score: 估算的 CVSS 基础评分 [0, 10]，如果无法估算则返回 None
            - meta_dict: 包含估算信息的字典，包含：
                - cvss_estimated: bool - 是否成功估算
                - max_similarity: float - 最大相似度值
                - reason: str - 如果未估算，说明原因（如 "LOW_SIMILARITY"）
    """
    if training_data is None or len(training_data) == 0:
        return None, {
            'cvss_estimated': False,
            'max_similarity': 0.0,
            'reason': 'NO_TRAINING_DATA'
        }
    
    try:
        from sklearn.metrics.pairwise import cosine_similarity
        
        # 对输入文本进行向量化
        input_vector = vectorizer.transform([processed_text])
        
        # 对训练数据的文本进行向量化（只处理一次，可以缓存）
        training_texts = training_data['text_description'].fillna("").tolist()
        training_vectors = vectorizer.transform(training_texts)
        
        # 计算余弦相似度
        similarities = cosine_similarity(input_vector, training_vectors)[0]
        
        # 找到最大相似度
        max_sim = float(np.max(similarities))
        
        # 如果最大相似度低于阈值，不估算 CVSS（防止无关文本被匹配到高 CVSS 样本）
        if max_sim < similarity_threshold:
            return None, {
                'cvss_estimated': False,
                'max_similarity': max_sim,
                'reason': 'LOW_SIMILARITY'
            }
        
        # 找到 top_k 最相似的样本
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        top_similarities = similarities[top_indices]
        
        # 过滤掉相似度太低的样本（阈值 0.1，低于 top1 的阈值检查）
        valid_mask = top_similarities > 0.1
        if not np.any(valid_mask):
            return None, {
                'cvss_estimated': False,
                'max_similarity': max_sim,
                'reason': 'LOW_SIMILARITY'
            }
        
        valid_indices = top_indices[valid_mask]
        valid_similarities = top_similarities[valid_mask]
        
        # 获取对应的 CVSS 值
        cvss_values = training_data.iloc[valid_indices]['cvss_base_score'].values
        
        # 加权平均（权重为相似度）
        weights = valid_similarities
        weighted_sum = np.sum(weights * cvss_values)
        weight_sum = np.sum(weights)
        
        if weight_sum > 0:
            estimated_cvss = weighted_sum / weight_sum
            # 四舍五入到一位小数，限制在 [0, 10] 范围内
            return round(max(0.0, min(10.0, estimated_cvss)), 1), {
                'cvss_estimated': True,
                'max_similarity': max_sim,
                'reason': None
            }
        else:
            return None, {
                'cvss_estimated': False,
                'max_similarity': max_sim,
                'reason': 'LOW_SIMILARITY'
            }
            
    except Exception as e:
        print(f"Warning: CVSS similarity estimation failed: {e}")
        return None, {
            'cvss_estimated': False,
            'max_similarity': 0.0,
            'reason': 'ESTIMATION_ERROR'
        }


def estimate_cvss_from_p_vuln(p_vuln):
    """
    根据漏洞概率估算 CVSS 基础评分（备用方法）
    
    当无法使用相似度估算时，使用此方法作为后备。
    
    Args:
        p_vuln: 漏洞概率 [0, 1]
    
    Returns:
        cvss_base_score: 估算的 CVSS 基础评分 [0, 10]
    """
    p = max(0.0, min(1.0, p_vuln))
    
    # 分段线性映射
    if p < 0.2:
        cvss = (p / 0.2) * 2.0
    elif p < 0.4:
        cvss = 2.0 + ((p - 0.2) / 0.2) * 2.0
    elif p < 0.6:
        cvss = 4.0 + ((p - 0.4) / 0.2) * 2.0
    elif p < 0.8:
        cvss = 6.0 + ((p - 0.6) / 0.2) * 1.5
    elif p < 0.9:
        cvss = 7.5 + ((p - 0.8) / 0.1) * 1.5
    else:
        cvss = 9.0 + ((p - 0.9) / 0.1) * 1.0
    
    return round(max(0.0, min(10.0, cvss)), 1)


def calculate_risk_for_batch(predictions, cvss_scores=None, alpha=0.6):
    """
    批量计算风险评分和等级
    
    Args:
        predictions: 模型预测概率数组
        cvss_scores: CVSS评分数组，可选
        alpha: 权重参数
    
    Returns:
        risk_scores: 风险评分数组
        risk_levels: 风险等级数组
    """
    predictions = np.array(predictions)
    risk_scores = []
    risk_levels = []
    
    for i, p_vuln in enumerate(predictions):
        cvss = cvss_scores[i] if cvss_scores is not None and i < len(cvss_scores) else None
        risk_score = calculate_risk_score(p_vuln, cvss, alpha)
        risk_level = get_risk_level(risk_score)
        risk_scores.append(risk_score)
        risk_levels.append(risk_level)
    
    return np.array(risk_scores), risk_levels


def assess_applicability(text, p_vuln, similarity_meta=None, tfidf_meta=None, cvss_input=None, 
                        clip_na_enabled=True, clip_pvuln_threshold=0.10, clip_sim_threshold=0.18,
                        clip_min_text_len=20, clip_min_nonzero_tfidf=3):
    """
    评估输入文本是否适用于漏洞风险评估（工程裁剪 - business clipping）
    
    对明显非漏洞语境文本，强制返回 applicable=false，以避免无关文本被错误评分。
    
    Args:
        text: 输入文本（处理后）
        p_vuln: 模型预测的漏洞概率 [0, 1]
        similarity_meta: 相似度元数据，包含 max_similarity（可选）
        tfidf_meta: TF-IDF 元数据，包含 nonzero_features（可选）
        cvss_input: 用户输入的 CVSS 值（如果提供，则不进行部分裁剪）
        clip_na_enabled: 是否启用裁剪（默认 True）
        clip_pvuln_threshold: p_vuln 阈值（默认 0.10）
        clip_sim_threshold: 相似度阈值（默认 0.18）
        clip_min_text_len: 最小文本长度（默认 20）
        clip_min_nonzero_tfidf: 最小非零 TF-IDF 特征数（默认 3）
    
    Returns:
        dict: {
            "applicable": bool,
            "reason": "EMPTY_TEXT" | "LOW_SIMILARITY" | "LOW_SIGNAL" | "LOW_PVULN" | None,
            "thresholds": {
                "clip_pvuln_threshold": float,
                "clip_sim_threshold": float,
                "clip_min_text_len": int,
                "clip_min_nonzero_tfidf": int
            },
            "debug": {
                "max_similarity": float | None,
                "nonzero_features": int | None,
                "text_len": int,
                "p_vuln": float
            }
        }
    """
    if not clip_na_enabled:
        return {
            "applicable": True,
            "reason": None,
            "thresholds": {
                "clip_pvuln_threshold": clip_pvuln_threshold,
                "clip_sim_threshold": clip_sim_threshold,
                "clip_min_text_len": clip_min_text_len,
                "clip_min_nonzero_tfidf": clip_min_nonzero_tfidf
            },
            "debug": {
                "max_similarity": similarity_meta.get('max_similarity') if similarity_meta else None,
                "nonzero_features": tfidf_meta.get('nonzero_features') if tfidf_meta else None,
                "text_len": len(text.strip()) if text else 0,
                "p_vuln": float(p_vuln)
            }
        }
    
    # 提取 debug 信息
    text_len = len(text.strip()) if text else 0
    max_similarity = similarity_meta.get('max_similarity') if similarity_meta else None
    nonzero_features = tfidf_meta.get('nonzero_features') if tfidf_meta else None
    has_user_cvss = cvss_input is not None and not (isinstance(cvss_input, float) and np.isnan(cvss_input))
    
    thresholds = {
        "clip_pvuln_threshold": clip_pvuln_threshold,
        "clip_sim_threshold": clip_sim_threshold,
        "clip_min_text_len": clip_min_text_len,
        "clip_min_nonzero_tfidf": clip_min_nonzero_tfidf
    }
    
    debug = {
        "max_similarity": max_similarity,
        "nonzero_features": nonzero_features,
        "text_len": text_len,
        "p_vuln": float(p_vuln)
    }
    
    # 裁剪触发条件（按优先级）
    
    # 1) 空或过短
    if text_len < clip_min_text_len:
        return {
            "applicable": False,
            "reason": "EMPTY_TEXT",
            "thresholds": thresholds,
            "debug": debug
        }
    
    # 2) 与漏洞语料相似度过低且用户未提供 cvss
    if max_similarity is not None and max_similarity < clip_sim_threshold and not has_user_cvss:
        return {
            "applicable": False,
            "reason": "LOW_SIMILARITY",
            "thresholds": thresholds,
            "debug": debug
        }
    
    # 3) 文本信号太弱（TF-IDF 非零特征太少）且用户未提供 cvss
    if nonzero_features is not None and nonzero_features < clip_min_nonzero_tfidf and not has_user_cvss:
        return {
            "applicable": False,
            "reason": "LOW_SIGNAL",
            "thresholds": thresholds,
            "debug": debug
        }
    
    # 4) 概率极低（作为补充条件，避免残留非零）且相似度低或无相似度
    if (p_vuln < clip_pvuln_threshold and 
        not has_user_cvss and 
        (max_similarity is None or max_similarity < clip_sim_threshold)):
        return {
            "applicable": False,
            "reason": "LOW_PVULN",
            "thresholds": thresholds,
            "debug": debug
        }
    
    # 所有条件都不满足，适用
    return {
        "applicable": True,
        "reason": None,
        "thresholds": thresholds,
        "debug": debug
    }
