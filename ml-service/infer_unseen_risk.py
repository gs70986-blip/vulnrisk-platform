"""
对未见数据进行风险预测的推理脚本
自动检测文本列，输出P(vuln)、RiskScore和RiskLevel
"""

import json
import sys
import os
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from risk import calculate_risk_score, get_risk_level


def auto_detect_text_column(df):
    """
    自动检测文本列
    
    Args:
        df: DataFrame
    
    Returns:
        text_column: 文本列名
    """
    # 可能的文本列名
    text_candidates = [
        'description_clean', 'description', 'text', 'content',
        'message', 'commit_message', 'issue_text', 'summary'
    ]
    
    for col in text_candidates:
        if col in df.columns:
            return col
    
    # 如果没有找到，返回第一个字符串类型的列
    for col in df.columns:
        if df[col].dtype == 'object':
            return col
    
    raise ValueError("无法找到文本列！")


def load_model(model_dir):
    """
    加载训练好的模型和预处理器
    
    Args:
        model_dir: 模型目录路径
    
    Returns:
        model: 训练好的模型
        vectorizer: TF-IDF向量化器
        metadata: 模型元数据
    """
    print(f"加载模型: {model_dir}")
    
    # 加载模型
    model_path = os.path.join(model_dir, 'model.joblib')
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"模型文件不存在: {model_path}")
    model = joblib.load(model_path)
    print("模型加载完成")
    
    # 加载向量化器
    vectorizer_path = os.path.join(model_dir, 'vectorizer.joblib')
    if not os.path.exists(vectorizer_path):
        raise FileNotFoundError(f"向量化器文件不存在: {vectorizer_path}")
    vectorizer = joblib.load(vectorizer_path)
    print("向量化器加载完成")
    
    # 加载元数据
    metadata_path = os.path.join(model_dir, 'metadata.json')
    metadata = {}
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        print("元数据加载完成")
    
    return model, vectorizer, metadata


def preprocess_text(texts):
    """
    预处理文本（与训练时保持一致）
    
    Args:
        texts: 文本列表
    
    Returns:
        processed_texts: 处理后的文本列表
    """
    import re
    processed_texts = []
    for text in texts:
        if pd.isna(text):
            processed_texts.append("")
            continue
        text_lower = str(text).lower()
        text_clean = re.sub(r'[^a-z0-9\s]', ' ', text_lower)
        text_clean = ' '.join(text_clean.split())
        processed_texts.append(text_clean)
    return processed_texts


def predict_unseen_data(csv_path, model_dir, output_path=None, text_column=None, alpha=0.6):
    """
    对未见数据进行风险预测
    
    Args:
        csv_path: 输入CSV文件路径
        model_dir: 模型目录路径
        output_path: 输出CSV文件路径（可选）
        text_column: 文本列名（可选，会自动检测）
        alpha: 风险评分权重参数
    
    Returns:
        df_results: 包含预测结果的DataFrame
    """
    print("=" * 60)
    print("未见数据风险预测")
    print("=" * 60)
    
    # 加载数据
    print(f"\n加载数据: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"数据形状: {df.shape}")
    print(f"列名: {df.columns.tolist()}")
    
    # 检测文本列
    if text_column is None:
        text_column = auto_detect_text_column(df)
    print(f"\n使用文本列: {text_column}")
    
    if text_column not in df.columns:
        raise ValueError(f"文本列不存在: {text_column}")
    
    # 加载模型
    model, vectorizer, metadata = load_model(model_dir)
    
    # 从元数据获取alpha（如果存在）
    if metadata and 'params' in metadata and 'alpha' in metadata['params']:
        alpha = metadata['params']['alpha']
        print(f"使用模型配置的alpha: {alpha}")
    
    # 预处理文本
    print("\n预处理文本...")
    texts = df[text_column].fillna("").astype(str).tolist()
    processed_texts = preprocess_text(texts)
    
    # 特征提取
    print("提取特征...")
    X = vectorizer.transform(processed_texts)
    print(f"特征矩阵形状: {X.shape}")
    
    # 预测
    print("\n进行预测...")
    y_pred_proba = model.predict_proba(X)[:, 1]
    print(f"预测完成，共 {len(y_pred_proba)} 个样本")
    
    # 计算风险评分
    print("\n计算风险评分...")
    df_results = df.copy()
    df_results['P(vuln)'] = y_pred_proba
    
    # 检查是否有CVSS评分
    has_cvss = 'cvss_base' in df.columns
    if has_cvss:
        print("检测到CVSS评分列，将用于风险评分计算")
        df_results['RiskScore'] = df_results.apply(
            lambda row: calculate_risk_score(
                row['P(vuln)'],
                row.get('cvss_base', None),
                alpha=alpha
            ), axis=1
        )
    else:
        print("未检测到CVSS评分列，仅使用P(vuln)计算风险评分")
        df_results['RiskScore'] = df_results['P(vuln)'].apply(
            lambda p: calculate_risk_score(p, None, alpha=alpha)
        )
    
    # 计算风险等级
    df_results['RiskLevel'] = df_results['RiskScore'].apply(get_risk_level)
    
    # 统计信息
    print("\n" + "=" * 60)
    print("预测结果统计")
    print("=" * 60)
    print(f"\n风险等级分布:")
    risk_level_counts = df_results['RiskLevel'].value_counts()
    for level, count in risk_level_counts.items():
        print(f"  {level}: {count} ({count/len(df_results)*100:.2f}%)")
    
    print(f"\n风险评分统计:")
    print(f"  平均值: {df_results['RiskScore'].mean():.4f}")
    print(f"  中位数: {df_results['RiskScore'].median():.4f}")
    print(f"  最小值: {df_results['RiskScore'].min():.4f}")
    print(f"  最大值: {df_results['RiskScore'].max():.4f}")
    
    print(f"\nP(vuln)统计:")
    print(f"  平均值: {df_results['P(vuln)'].mean():.4f}")
    print(f"  中位数: {df_results['P(vuln)'].median():.4f}")
    
    # 保存结果
    if output_path:
        df_results.to_csv(output_path, index=False)
        print(f"\n结果已保存到: {output_path}")
    else:
        # 默认输出路径
        input_path = Path(csv_path)
        output_path = input_path.parent / f"{input_path.stem}_predictions.csv"
        df_results.to_csv(output_path, index=False)
        print(f"\n结果已保存到: {output_path}")
    
    return df_results


def main():
    """主函数"""
    if len(sys.argv) < 3:
        print("用法: python infer_unseen_risk.py <csv_path> <model_dir> [output_path] [text_column]")
        print("\n示例:")
        print("  python infer_unseen_risk.py data/unseen.csv models/risk_model_001")
        print("  python infer_unseen_risk.py data/unseen.csv models/risk_model_001 output.csv description")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    model_dir = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else None
    text_column = sys.argv[4] if len(sys.argv) > 4 else None
    
    predict_unseen_data(csv_path, model_dir, output_path, text_column)


if __name__ == "__main__":
    main()











