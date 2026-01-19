"""
风险分析可视化脚本
生成风险评分分布、P(vuln)直方图、高风险样本等图表
"""

import json
import sys
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from risk import get_risk_level

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial Unicode MS', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# 设置样式
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (12, 8)


def plot_risk_score_distribution(df, output_dir):
    """
    绘制风险评分分布图
    
    Args:
        df: 包含RiskScore的DataFrame
        output_dir: 输出目录
    """
    fig, axes = plt.subplots(2, 1, figsize=(12, 10))
    
    # 直方图
    axes[0].hist(df['RiskScore'], bins=50, edgecolor='black', alpha=0.7)
    axes[0].set_xlabel('风险评分 (RiskScore)', fontsize=12)
    axes[0].set_ylabel('频数', fontsize=12)
    axes[0].set_title('风险评分分布直方图', fontsize=14, fontweight='bold')
    axes[0].axvline(df['RiskScore'].mean(), color='r', linestyle='--', 
                     label=f'平均值: {df["RiskScore"].mean():.3f}')
    axes[0].axvline(df['RiskScore'].median(), color='g', linestyle='--', 
                     label=f'中位数: {df["RiskScore"].median():.3f}')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)
    
    # 按风险等级分组
    if 'RiskLevel' in df.columns:
        risk_levels = ['Low', 'Medium', 'High', 'Critical']
        colors = ['green', 'yellow', 'orange', 'red']
        counts = [len(df[df['RiskLevel'] == level]) for level in risk_levels]
        
        axes[1].bar(risk_levels, counts, color=colors, alpha=0.7, edgecolor='black')
        axes[1].set_xlabel('风险等级', fontsize=12)
        axes[1].set_ylabel('样本数', fontsize=12)
        axes[1].set_title('风险等级分布', fontsize=14, fontweight='bold')
        axes[1].grid(True, alpha=0.3, axis='y')
        
        # 添加数值标签
        for i, (level, count) in enumerate(zip(risk_levels, counts)):
            axes[1].text(i, count, str(count), ha='center', va='bottom', fontsize=10)
    
    plt.tight_layout()
    output_path = os.path.join(output_dir, 'risk_score_distribution.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"风险评分分布图已保存: {output_path}")
    plt.close()


def plot_p_vuln_histogram(df, output_dir):
    """
    绘制P(vuln)直方图
    
    Args:
        df: 包含P(vuln)的DataFrame
        output_dir: 输出目录
    """
    fig, axes = plt.subplots(2, 1, figsize=(12, 10))
    
    # 直方图
    axes[0].hist(df['P(vuln)'], bins=50, edgecolor='black', alpha=0.7, color='steelblue')
    axes[0].set_xlabel('P(vuln)', fontsize=12)
    axes[0].set_ylabel('频数', fontsize=12)
    axes[0].set_title('P(vuln) 分布直方图', fontsize=14, fontweight='bold')
    axes[0].axvline(df['P(vuln)'].mean(), color='r', linestyle='--', 
                     label=f'平均值: {df["P(vuln)"].mean():.3f}')
    axes[0].axvline(0.5, color='gray', linestyle=':', label='阈值: 0.5')
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)
    
    # 箱线图
    if 'RiskLevel' in df.columns:
        risk_levels = ['Low', 'Medium', 'High', 'Critical']
        data_by_level = [df[df['RiskLevel'] == level]['P(vuln)'].values for level in risk_levels]
        
        bp = axes[1].boxplot(data_by_level, labels=risk_levels, patch_artist=True)
        colors = ['green', 'yellow', 'orange', 'red']
        for patch, color in zip(bp['boxes'], colors):
            patch.set_facecolor(color)
            patch.set_alpha(0.7)
        
        axes[1].set_xlabel('风险等级', fontsize=12)
        axes[1].set_ylabel('P(vuln)', fontsize=12)
        axes[1].set_title('不同风险等级的P(vuln)分布', fontsize=14, fontweight='bold')
        axes[1].grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    output_path = os.path.join(output_dir, 'p_vuln_histogram.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"P(vuln)直方图已保存: {output_path}")
    plt.close()


def plot_top_risk_samples(df, output_dir, top_n=20, text_column=None):
    """
    绘制高风险样本
    
    Args:
        df: 包含预测结果的DataFrame
        output_dir: 输出目录
        top_n: 显示前N个高风险样本
        text_column: 文本列名（用于显示）
    """
    # 按风险评分排序
    df_sorted = df.nlargest(top_n, 'RiskScore')
    
    fig, ax = plt.subplots(figsize=(14, max(8, top_n * 0.4)))
    
    y_pos = np.arange(len(df_sorted))
    colors = []
    for level in df_sorted['RiskLevel']:
        if level == 'Critical':
            colors.append('red')
        elif level == 'High':
            colors.append('orange')
        elif level == 'Medium':
            colors.append('yellow')
        else:
            colors.append('green')
    
    bars = ax.barh(y_pos, df_sorted['RiskScore'], color=colors, alpha=0.7, edgecolor='black')
    
    # 设置标签
    labels = []
    for idx, row in df_sorted.iterrows():
        label_parts = []
        if 'cve_id' in row:
            label_parts.append(f"CVE: {row['cve_id']}")
        if text_column and text_column in row:
            text = str(row[text_column])[:50]
            label_parts.append(f"Text: {text}...")
        label_parts.append(f"Score: {row['RiskScore']:.3f}")
        labels.append('\n'.join(label_parts))
    
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_xlabel('风险评分', fontsize=12)
    ax.set_title(f'Top {top_n} 高风险样本', fontsize=14, fontweight='bold')
    ax.set_xlim(0, 1.0)
    ax.grid(True, alpha=0.3, axis='x')
    
    plt.tight_layout()
    output_path = os.path.join(output_dir, 'top_risk_samples.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"高风险样本图已保存: {output_path}")
    plt.close()


def plot_risk_vs_cvss(df, output_dir):
    """
    绘制风险评分与CVSS评分的关系
    
    Args:
        df: 包含RiskScore和cvss_base的DataFrame
        output_dir: 输出目录
    """
    if 'cvss_base' not in df.columns:
        print("未找到CVSS评分列，跳过风险评分与CVSS关系图")
        return
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # 散点图
    scatter = ax.scatter(df['cvss_base'], df['RiskScore'], 
                         c=df['P(vuln)'], cmap='viridis', 
                         alpha=0.6, s=50, edgecolors='black', linewidth=0.5)
    
    ax.set_xlabel('CVSS基础评分', fontsize=12)
    ax.set_ylabel('风险评分 (RiskScore)', fontsize=12)
    ax.set_title('风险评分 vs CVSS基础评分', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    
    # 添加颜色条
    cbar = plt.colorbar(scatter, ax=ax)
    cbar.set_label('P(vuln)', fontsize=12)
    
    plt.tight_layout()
    output_path = os.path.join(output_dir, 'risk_vs_cvss.png')
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"风险评分与CVSS关系图已保存: {output_path}")
    plt.close()


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python plot_risk_analysis.py <predictions_csv> [output_dir] [config_json]")
        print("\n示例:")
        print("  python plot_risk_analysis.py predictions.csv")
        print("  python plot_risk_analysis.py predictions.csv output/figures config.json")
        sys.exit(1)
    
    predictions_csv = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else 'risk_analysis_figures'
    config_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    # 加载配置（如果有）
    config = {}
    if config_path and os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    
    print("=" * 60)
    print("风险分析可视化")
    print("=" * 60)
    
    # 加载预测结果
    print(f"\n加载预测结果: {predictions_csv}")
    df = pd.read_csv(predictions_csv)
    print(f"数据形状: {df.shape}")
    
    # 检查必要的列
    required_cols = ['P(vuln)', 'RiskScore', 'RiskLevel']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"缺少必要的列: {missing_cols}")
    
    # 生成图表
    print("\n生成可视化图表...")
    
    plot_risk_score_distribution(df, output_dir)
    plot_p_vuln_histogram(df, output_dir)
    
    text_column = config.get('text_column', 'description_clean')
    if text_column not in df.columns:
        text_column = None
    plot_top_risk_samples(df, output_dir, top_n=20, text_column=text_column)
    
    plot_risk_vs_cvss(df, output_dir)
    
    print("\n" + "=" * 60)
    print("可视化完成！")
    print("=" * 60)
    print(f"所有图表已保存到: {output_dir}")


if __name__ == "__main__":
    main()











