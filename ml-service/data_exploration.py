"""
数据探索和预处理模块
用于加载、预处理CVE数据集并构建风险标签
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path


def load_cve_dataset(csv_path):
    """
    加载CVE数据集
    
    Args:
        csv_path: CSV文件路径
    
    Returns:
        df: 加载的DataFrame
    """
    print(f"正在加载数据集: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"数据集形状: {df.shape}")
    print(f"列名: {df.columns.tolist()}")
    return df


def preprocess_dataset(df, text_column='description_clean'):
    """
    预处理数据集并构建风险标签
    
    标签构建规则:
    - y = 1 如果 cvss_base >= 7.0 (High或Critical)
    - y = 0 如果 cvss_base < 7.0 (Low或Medium)
    - 如果cvss_base缺失，从cvss_severity推断
    
    Args:
        df: 原始DataFrame
        text_column: 文本特征列名
    
    Returns:
        df: 预处理后的DataFrame（包含y列）
    """
    print("\n开始预处理数据集...")
    
    # 检查必要的列
    required_cols = [text_column]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"缺少必要的列: {missing_cols}")
    
    # 处理缺失值
    print("处理缺失值...")
    if text_column in df.columns:
        df[text_column] = df[text_column].fillna("")
    
    # 构建二进制风险标签
    print("构建风险标签...")
    df['y'] = -1  # 默认值，表示缺失标签
    
    # 规则1: 使用cvss_base
    if 'cvss_base' in df.columns:
        df.loc[df['cvss_base'] >= 7.0, 'y'] = 1
        df.loc[df['cvss_base'] < 7.0, 'y'] = 0
    
    # 规则2: 如果cvss_base缺失，使用cvss_severity推断
    if 'cvss_severity' in df.columns:
        df.loc[(df['y'] == -1) & (df['cvss_severity'].isin(['HIGH', 'CRITICAL'])), 'y'] = 1
        df.loc[(df['y'] == -1) & (df['cvss_severity'].isin(['MEDIUM', 'LOW', 'NONE'])), 'y'] = 0
    
    # 统计标签分布
    valid_labels = df[df['y'] != -1]
    if len(valid_labels) > 0:
        label_counts = valid_labels['y'].value_counts()
        print(f"\n标签分布:")
        print(f"  高风险 (y=1): {label_counts.get(1, 0)} ({label_counts.get(1, 0)/len(valid_labels)*100:.2f}%)")
        print(f"  低风险 (y=0): {label_counts.get(0, 0)} ({label_counts.get(0, 0)/len(valid_labels)*100:.2f}%)")
        print(f"  缺失标签: {len(df[df['y'] == -1])}")
    else:
        print("警告: 没有有效的标签数据！")
    
    return df


def save_preprocessing_report(df, output_path):
    """
    保存预处理报告
    
    Args:
        df: 预处理后的DataFrame
        output_path: 输出文件路径
    """
    report = {
        'total_samples': len(df),
        'columns': df.columns.tolist(),
        'missing_values': df.isnull().sum().to_dict(),
        'label_distribution': {}
    }
    
    if 'y' in df.columns:
        valid_labels = df[df['y'] != -1]
        if len(valid_labels) > 0:
            label_counts = valid_labels['y'].value_counts().to_dict()
            report['label_distribution'] = {
                'high_risk': int(label_counts.get(1, 0)),
                'low_risk': int(label_counts.get(0, 0)),
                'missing': int(len(df[df['y'] == -1]))
            }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n预处理报告已保存到: {output_path}")


if __name__ == "__main__":
    # 测试代码
    import sys
    if len(sys.argv) < 2:
        print("用法: python data_exploration.py <csv_path>")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    df = load_cve_dataset(csv_path)
    df = preprocess_dataset(df)
    
    output_dir = Path("reports")
    output_dir.mkdir(exist_ok=True)
    save_preprocessing_report(df, output_dir / "preprocessing_report.json")











