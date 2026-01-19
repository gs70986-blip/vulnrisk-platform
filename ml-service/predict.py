"""
独立的预测脚本
用于命令行预测
"""

import sys
import os
import json
import joblib
import pandas as pd
from pathlib import Path

# 导入自定义模块
from risk import calculate_risk_score, get_risk_level


def preprocess_text(text):
    """预处理文本"""
    if pd.isna(text) or not text:
        return ""
    
    import re
    text_lower = str(text).lower()
    text_clean = re.sub(r'[^a-z0-9\s]', ' ', text_lower)
    text_clean = ' '.join(text_clean.split())
    return text_clean


def predict_single(model_dir, text_description, cvss_base_score=None, alpha=0.6):
    """
    单样本预测
    
    Args:
        model_dir: 模型目录
        text_description: 文本描述
        cvss_base_score: CVSS评分（可选）
        alpha: 风险评分权重
    
    Returns:
        dict: 预测结果
    """
    # 加载模型
    model_path = os.path.join(model_dir, 'model.joblib')
    vectorizer_path = os.path.join(model_dir, 'vectorizer.joblib')
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not os.path.exists(vectorizer_path):
        raise FileNotFoundError(f"Vectorizer not found: {vectorizer_path}")
    
    model = joblib.load(model_path)
    vectorizer = joblib.load(vectorizer_path)
    
    # 加载元数据（获取alpha）
    metadata_path = os.path.join(model_dir, 'metadata.json')
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
            alpha = metadata.get('params', {}).get('alpha', alpha)
    
    # 预处理
    processed_text = preprocess_text(text_description)
    
    # 特征提取
    X = vectorizer.transform([processed_text])
    
    # 预测
    p_vuln = model.predict_proba(X)[0, 1]
    
    # 计算风险评分
    risk_score = calculate_risk_score(p_vuln, cvss_base_score, alpha=alpha)
    risk_level = get_risk_level(risk_score)
    
    return {
        'p_vuln': float(p_vuln),
        'risk_score': float(risk_score),
        'risk_level': risk_level
    }


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("用法: python predict.py <model_dir> <text_description> [cvss_base_score]")
        sys.exit(1)
    
    model_dir = sys.argv[1]
    text_description = sys.argv[2]
    cvss_base_score = float(sys.argv[3]) if len(sys.argv) > 3 else None
    
    try:
        result = predict_single(model_dir, text_description, cvss_base_score)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)
