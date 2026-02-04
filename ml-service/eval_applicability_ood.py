"""
Stage A Applicability模型的OOD（Out-of-Distribution）鲁棒性评估

评估内容：
1. In-domain评估：CVE vs 原始GitHub issues测试集
2. OOD评估：CVE positives vs 每个负类子类
   - Noise negatives
   - Keyword-only negatives
   - Patch/mitigation negatives
"""

import json
import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    classification_report
)

# 导入训练脚本中的预处理函数
from train_applicability_model import preprocess_text, SEED


def load_model_and_vectorizer(model_dir: Path):
    """加载模型和向量化器"""
    model_path = model_dir / 'model.joblib'
    vectorizer_path = model_dir / 'vectorizer.joblib'
    metadata_path = model_dir / 'metadata.json'
    
    if not model_path.exists() or not vectorizer_path.exists():
        raise FileNotFoundError(f'模型文件不存在: {model_dir}')
    
    model = joblib.load(model_path)
    vectorizer = joblib.load(vectorizer_path)
    
    metadata = {}
    if metadata_path.exists():
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
    
    app_threshold = metadata.get('app_threshold', 0.5)
    
    return model, vectorizer, app_threshold, metadata


def evaluate_set(model, vectorizer, app_threshold, texts, labels, set_name: str):
    """评估一个数据集"""
    # 预处理
    processed_texts = [preprocess_text(text) for text in texts]
    
    # 向量化
    X = vectorizer.transform(processed_texts)
    
    # 预测
    y_pred_proba = model.predict_proba(X)[:, 1]
    y_pred = (y_pred_proba >= app_threshold).astype(int)
    
    # 计算指标
    accuracy = accuracy_score(labels, y_pred)
    precision = precision_score(labels, y_pred, zero_division=0)
    recall = recall_score(labels, y_pred, zero_division=0)
    f1 = f1_score(labels, y_pred, zero_division=0)
    
    # 对于负类，计算False Positive Rate（FPR）
    if len(set(labels)) == 1 and 0 in labels:
        # 全是负类
        fpr = np.mean(y_pred == 1)  # 被错误标记为applicable的比例
        auroc = None
        auprc = None
    elif len(set(labels)) == 1 and 1 in labels:
        # 全是正类
        fpr = None
        try:
            auroc = roc_auc_score(labels, y_pred_proba)
            auprc = average_precision_score(labels, y_pred_proba)
        except:
            auroc = None
            auprc = None
    else:
        # 混合类
        tn, fp, fn, tp = confusion_matrix(labels, y_pred).ravel()
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        try:
            auroc = roc_auc_score(labels, y_pred_proba)
            auprc = average_precision_score(labels, y_pred_proba)
        except:
            auroc = None
            auprc = None
    
    # 混淆矩阵
    cm = confusion_matrix(labels, y_pred)
    
    results = {
        'set_name': set_name,
        'n_samples': len(texts),
        'n_positive': int(np.sum(labels == 1)),
        'n_negative': int(np.sum(labels == 0)),
        'accuracy': float(accuracy),
        'precision': float(precision),
        'recall': float(recall),
        'f1_score': float(f1),
        'false_positive_rate': float(fpr) if fpr is not None else None,
        'auroc': float(auroc) if auroc is not None else None,
        'auprc': float(auprc) if auprc is not None else None,
        'confusion_matrix': cm.tolist(),
        'mean_predicted_probability': float(np.mean(y_pred_proba)),
    }
    
    return results, pd.DataFrame({
        'text': texts,
        'label': labels,
        'p_applicable': y_pred_proba,
        'predicted': y_pred,
    })


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python eval_applicability_ood.py <model_dir>")
        print("示例: python eval_applicability_ood.py models/app_model_002_aug_xgb")
        sys.exit(1)
    
    model_dir = Path(sys.argv[1])
    if not model_dir.exists():
        print(f"错误: 模型目录不存在: {model_dir}")
        sys.exit(1)
    
    print("=" * 60)
    print("Stage A Applicability OOD鲁棒性评估")
    print("=" * 60)
    print(f"模型目录: {model_dir}\n")
    
    # 加载模型
    print("加载模型...")
    model, vectorizer, app_threshold, metadata = load_model_and_vectorizer(model_dir)
    print(f"  阈值 (app_threshold): {app_threshold:.3f}\n")
    
    # 路径配置
    ml_service_dir = Path(__file__).parent
    cve_csv_path = ml_service_dir / 'merged_json_table.csv'
    github_csv_path = ml_service_dir / 'negative_github_issues.csv'
    data_aug_dir = ml_service_dir / 'data_aug'
    
    # 加载数据
    print("加载数据...")
    
    # 1. CVE正类（用于所有评估）
    df_cve = pd.read_csv(cve_csv_path)
    df_cve_valid = df_cve[
        df_cve['description_clean'].notna() & 
        (df_cve['description_clean'].astype(str).str.len() >= 20)
    ].copy()
    cve_texts = df_cve_valid['description_clean'].astype(str).tolist()
    cve_labels = np.ones(len(cve_texts), dtype=int)
    
    # 采样CVE用于评估（使用测试集部分，避免与训练集重叠）
    np.random.seed(SEED)
    n_cve_eval = min(1000, len(cve_texts))
    eval_indices = np.random.choice(len(cve_texts), n_cve_eval, replace=False)
    cve_texts_eval = [cve_texts[i] for i in eval_indices]
    cve_labels_eval = cve_labels[eval_indices]
    
    print(f"  CVE正类: {len(cve_texts_eval)} 条（用于评估）")
    
    # 2. GitHub负类（in-domain）
    df_github = pd.read_csv(github_csv_path)
    df_github_valid = df_github[
        df_github['text'].notna() & 
        (df_github['text'].astype(str).str.len() >= 60)
    ].copy()
    github_texts = df_github_valid['text'].astype(str).tolist()
    github_labels = np.zeros(len(github_texts), dtype=int)
    
    # 采样GitHub用于评估
    n_github_eval = min(1000, len(github_texts))
    eval_indices = np.random.choice(len(github_texts), n_github_eval, replace=False)
    github_texts_eval = [github_texts[i] for i in eval_indices]
    github_labels_eval = github_labels[eval_indices]
    
    print(f"  GitHub负类: {len(github_texts_eval)} 条")
    
    # 3. 增强负类（OOD）
    aug_datasets = {
        'noise': 'neg_noise.csv',
        'keyword_only': 'neg_keyword_only.csv',
        'patch_mitigation': 'neg_patch_mitigation.csv',
    }
    
    aug_data = {}
    for subclass, filename in aug_datasets.items():
        csv_path = data_aug_dir / filename
        if not csv_path.exists():
            print(f"  警告: {filename} 不存在，跳过")
            continue
        
        df = pd.read_csv(csv_path)
        df_valid = df[
            df['text'].notna() & 
            (df['text'].astype(str).str.len() >= 15)
        ].copy()
        
        texts = df_valid['text'].astype(str).tolist()
        labels = np.zeros(len(texts), dtype=int)
        
        # 采样用于评估
        n_eval = min(1000, len(texts))
        eval_indices = np.random.choice(len(texts), n_eval, replace=False)
        aug_data[subclass] = {
            'texts': [texts[i] for i in eval_indices],
            'labels': labels[eval_indices],
        }
        
        print(f"  {subclass}: {len(aug_data[subclass]['texts'])} 条")
    
    print()
    
    # 执行评估
    all_results = []
    all_predictions = {}
    
    # 1. In-domain评估：CVE vs GitHub
    print("=" * 60)
    print("1. In-domain评估 (CVE vs GitHub)")
    print("=" * 60)
    
    # 合并CVE和GitHub
    in_domain_texts = cve_texts_eval + github_texts_eval
    in_domain_labels = np.concatenate([cve_labels_eval, github_labels_eval])
    
    results, predictions = evaluate_set(
        model, vectorizer, app_threshold,
        in_domain_texts, in_domain_labels,
        'in_domain_cve_vs_github'
    )
    all_results.append(results)
    all_predictions['in_domain'] = predictions
    
    print(f"准确率: {results['accuracy']:.4f}")
    print(f"精确率: {results['precision']:.4f}")
    print(f"召回率: {results['recall']:.4f}")
    print(f"F1分数: {results['f1_score']:.4f}")
    if results['auroc'] is not None:
        print(f"AUROC: {results['auroc']:.4f}")
    if results['auprc'] is not None:
        print(f"AUPRC: {results['auprc']:.4f}")
    print(f"混淆矩阵:\n{np.array(results['confusion_matrix'])}")
    print()
    
    # 2. OOD评估：CVE vs 每个负类子类
    print("=" * 60)
    print("2. OOD评估 (CVE vs 各负类子类)")
    print("=" * 60)
    
    for subclass, data in aug_data.items():
        print(f"\n--- {subclass.upper()} ---")
        
        # 合并CVE正类和该子类负类
        ood_texts = cve_texts_eval + data['texts']
        ood_labels = np.concatenate([cve_labels_eval, data['labels']])
        
        results, predictions = evaluate_set(
            model, vectorizer, app_threshold,
            ood_texts, ood_labels,
            f'ood_cve_vs_{subclass}'
        )
        all_results.append(results)
        all_predictions[subclass] = predictions
        
        print(f"准确率: {results['accuracy']:.4f}")
        print(f"精确率: {results['precision']:.4f}")
        print(f"召回率: {results['recall']:.4f}")
        print(f"F1分数: {results['f1_score']:.4f}")
        print(f"负类FPR: {results['false_positive_rate']:.4f}")
        if results['auroc'] is not None:
            print(f"AUROC: {results['auroc']:.4f}")
        if results['auprc'] is not None:
            print(f"AUPRC: {results['auprc']:.4f}")
        print(f"混淆矩阵:\n{np.array(results['confusion_matrix'])}")
    
    # 保存结果
    print("\n" + "=" * 60)
    print("保存评估结果")
    print("=" * 60)
    
    # JSON报告
    report_json = {
        'model_dir': str(model_dir),
        'app_threshold': float(app_threshold),
        'evaluation_date': pd.Timestamp.now().isoformat(),
        'results': all_results,
    }
    
    json_path = model_dir / 'ood_eval_report.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(report_json, f, indent=2, ensure_ascii=False)
    print(f"JSON报告已保存: {json_path}")
    
    # Markdown报告
    md_lines = [
        "# Stage A Applicability OOD鲁棒性评估报告",
        "",
        f"**模型目录**: `{model_dir}`",
        f"**评估日期**: {report_json['evaluation_date']}",
        f"**阈值 (app_threshold)**: {app_threshold:.3f}",
        "",
        "## 评估结果摘要",
        "",
        "| 评估集 | 样本数 | 准确率 | 精确率 | 召回率 | F1 | FPR | AUROC | AUPRC |",
        "|--------|--------|--------|--------|--------|----|----|----|----|",
    ]
    
    for result in all_results:
        row = [
            result['set_name'],
            str(result['n_samples']),
            f"{result['accuracy']:.4f}",
            f"{result['precision']:.4f}",
            f"{result['recall']:.4f}",
            f"{result['f1_score']:.4f}",
            f"{result['false_positive_rate']:.4f}" if result['false_positive_rate'] is not None else "N/A",
            f"{result['auroc']:.4f}" if result['auroc'] is not None else "N/A",
            f"{result['auprc']:.4f}" if result['auprc'] is not None else "N/A",
        ]
        md_lines.append("| " + " | ".join(row) + " |")
    
    md_lines.extend([
        "",
        "## 详细结果",
        "",
    ])
    
    for result in all_results:
        md_lines.extend([
            f"### {result['set_name']}",
            "",
            f"- **样本数**: {result['n_samples']}",
            f"- **正类数**: {result['n_positive']}",
            f"- **负类数**: {result['n_negative']}",
            f"- **准确率**: {result['accuracy']:.4f}",
            f"- **精确率**: {result['precision']:.4f}",
            f"- **召回率**: {result['recall']:.4f}",
            f"- **F1分数**: {result['f1_score']:.4f}",
        ])
        
        if result['false_positive_rate'] is not None:
            md_lines.append(f"- **False Positive Rate (FPR)**: {result['false_positive_rate']:.4f}")
        
        if result['auroc'] is not None:
            md_lines.append(f"- **AUROC**: {result['auroc']:.4f}")
        if result['auprc'] is not None:
            md_lines.append(f"- **AUPRC**: {result['auprc']:.4f}")
        
        md_lines.extend([
            "",
            "**混淆矩阵**:",
            "",
            "```",
            f"TN={result['confusion_matrix'][0][0]}, FP={result['confusion_matrix'][0][1]}",
            f"FN={result['confusion_matrix'][1][0]}, TP={result['confusion_matrix'][1][1]}",
            "```",
            "",
        ])
    
    md_lines.extend([
        "## 解释",
        "",
        "- **In-domain评估**: 评估模型在训练分布内的表现（CVE vs GitHub issues）",
        "- **OOD评估**: 评估模型在分布外数据上的鲁棒性（CVE vs 各负类子类）",
        "- **FPR (False Positive Rate)**: 负类被错误标记为applicable的比例，越低越好",
        "- **AUROC**: Area Under ROC Curve，衡量分类器区分正负类的能力",
        "- **AUPRC**: Area Under Precision-Recall Curve，在类别不平衡时更有意义",
        "",
    ])
    
    md_path = model_dir / 'ood_eval_report.md'
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(md_lines))
    print(f"Markdown报告已保存: {md_path}")
    
    # 保存每个评估集的预测结果
    for set_name, predictions_df in all_predictions.items():
        csv_path = model_dir / f'ood_eval_{set_name}_predictions.csv'
        predictions_df.to_csv(csv_path, index=False)
        print(f"预测结果已保存: {csv_path}")
    
    print("\n" + "=" * 60)
    print("评估完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()


