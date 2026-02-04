"""
Stage B: 训练 Severity 模型（4类风险等级）
将原来"CVSS≥7 二分类"改为 4 类严重度多分类

标签定义:
    0 Low: [0, 4.0)
    1 Medium: [4.0, 7.0)
    2 High: [7.0, 9.0)
    3 Critical: [9.0, 10.0]

用法:
    python train_severity_model.py <config_json>

示例:
    python train_severity_model.py train_severity_config.json
"""

import json
import sys
import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix
)
from imblearn.over_sampling import SMOTE
import xgboost as xgb
from datetime import datetime

# 导入自定义模块
from data_exploration import load_cve_dataset
from risk import calculate_risk_score, get_risk_level


# 标签定义
SEVERITY_LABELS = {
    0: {'name': 'Low', 'range': '[0, 4.0)'},
    1: {'name': 'Medium', 'range': '[4.0, 7.0)'},
    2: {'name': 'High', 'range': '[7.0, 9.0)'},
    3: {'name': 'Critical', 'range': '[9.0, 10.0]'},
}

SEVERITY_MAPPING = {
    'LOW': 0,
    'MEDIUM': 1,
    'HIGH': 2,
    'CRITICAL': 3,
    'NONE': 0,
}


def build_severity_label(cvss_base, cvss_severity):
    """
    构建4类严重度标签
    
    Args:
        cvss_base: CVSS基础评分（0-10）
        cvss_severity: CVSS严重程度字符串
    
    Returns:
        label: 0 (Low), 1 (Medium), 2 (High), 3 (Critical), -1 (无效)
    """
    # 优先使用 cvss_base
    if pd.notna(cvss_base) and 0 <= cvss_base <= 10:
        if cvss_base < 4.0:
            return 0  # Low
        elif cvss_base < 7.0:
            return 1  # Medium
        elif cvss_base < 9.0:
            return 2  # High
        else:
            return 3  # Critical
    
    # 如果 cvss_base 缺失，使用 cvss_severity
    if pd.notna(cvss_severity):
        severity_upper = str(cvss_severity).upper()
        if severity_upper in SEVERITY_MAPPING:
            return SEVERITY_MAPPING[severity_upper]
    
    # 两者都缺失，返回无效
    return -1


def preprocess_dataset_severity(df, text_column='description_clean'):
    """
    预处理数据集并构建4类严重度标签
    
    Args:
        df: 原始DataFrame
        text_column: 文本特征列名
    
    Returns:
        df: 预处理后的DataFrame（包含severity_label列）
    """
    print("\n开始预处理数据集...")
    
    # 检查必要的列
    required_cols = [text_column]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"缺少必要的列: {missing_cols}")
    
    # 处理缺失值
    print("处理缺失值...")
    df[text_column] = df[text_column].fillna("").astype(str)
    
    # 构建严重度标签
    print("构建严重度标签...")
    df['severity_label'] = df.apply(
        lambda row: build_severity_label(
            row.get('cvss_base'),
            row.get('cvss_severity')
        ),
        axis=1
    )
    
    # 统计标签分布
    valid_labels = df[df['severity_label'] != -1]
    print(f"\n标签分布:")
    for label_id in range(4):
        count = len(valid_labels[valid_labels['severity_label'] == label_id])
        label_name = SEVERITY_LABELS[label_id]['name']
        print(f"  {label_name} (label={label_id}): {count} ({count/len(valid_labels)*100:.2f}%)" if len(valid_labels) > 0 else f"  {label_name} (label={label_id}): {count}")
    
    invalid_count = len(df[df['severity_label'] == -1])
    print(f"  无效标签: {invalid_count}")
    
    return df


def build_feature_pipeline(df, text_column='description_clean', max_features=20000):
    """
    构建特征工程管道
    
    Args:
        df: 数据DataFrame
        text_column: 文本列名
        max_features: TF-IDF最大特征数
    
    Returns:
        vectorizer: 拟合的TF-IDF向量化器
        X: 特征矩阵
        feature_names: 特征名称列表
    """
    print(f"\n构建特征工程管道...")
    print(f"文本列: {text_column}")
    print(f"最大特征数: {max_features}")
    
    # 文本预处理
    texts = df[text_column].fillna("").astype(str).tolist()
    
    # 清理文本
    import re
    processed_texts = []
    for text in texts:
        text_lower = str(text).lower()
        text_clean = re.sub(r'[^a-z0-9\s]', ' ', text_lower)
        text_clean = ' '.join(text_clean.split())
        processed_texts.append(text_clean)
    
    # TF-IDF向量化
    vectorizer = TfidfVectorizer(
        max_features=max_features,
        stop_words='english',
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95,
        lowercase=True
    )
    
    X = vectorizer.fit_transform(processed_texts)
    feature_names = vectorizer.get_feature_names_out()
    
    print(f"特征矩阵形状: {X.shape}")
    print(f"特征数量: {len(feature_names)}")
    
    return vectorizer, X, feature_names


def train_severity_model(X_train, y_train, X_test, y_test, model_type='XGBoost',
                         random_state=42, feature_names=None):
    """
    训练4类严重度分类模型
    
    Args:
        X_train: 训练特征
        y_train: 训练标签（0-3）
        X_test: 测试特征
        y_test: 测试标签
        model_type: 模型类型 ('XGBoost' 或 'RandomForest')
        random_state: 随机种子
        feature_names: TF-IDF特征名称列表
    
    Returns:
        model: 训练好的模型
        metrics: 性能指标字典
        feature_importance: 特征重要性列表
    """
    print(f"\n训练{model_type}多分类模型（4类严重度）...")
    
    # 构建基础模型
    if model_type == 'XGBoost':
        base_model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=random_state,
            eval_metric='mlogloss',  # 多分类使用mlogloss
            use_label_encoder=False,
            objective='multi:softprob',  # 多分类
            num_class=4,  # 4类
        )
    elif model_type == 'RandomForest':
        base_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=None,
            random_state=random_state,
            n_jobs=-1,
            class_weight='balanced'  # 自动平衡类别权重
        )
    else:
        raise ValueError(f"不支持的模型类型: {model_type}")
    
    # 训练
    print("开始训练...")
    model = base_model
    model.fit(X_train, y_train)
    print("训练完成！")
    
    # 预测
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)
    
    # 计算指标（多分类）
    metrics = {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'macro_precision': float(precision_score(y_test, y_pred, average='macro', zero_division=0)),
        'macro_recall': float(recall_score(y_test, y_pred, average='macro', zero_division=0)),
        'macro_f1': float(f1_score(y_test, y_pred, average='macro', zero_division=0)),
        'weighted_f1': float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
    }
    
    # 每类指标
    per_class_metrics = {}
    for label_id in range(4):
        label_name = SEVERITY_LABELS[label_id]['name']
        precision = float(precision_score(y_test, y_pred, labels=[label_id], average='macro', zero_division=0))
        recall = float(recall_score(y_test, y_pred, labels=[label_id], average='macro', zero_division=0))
        f1 = float(f1_score(y_test, y_pred, labels=[label_id], average='macro', zero_division=0))
        per_class_metrics[label_name] = {
            'precision': precision,
            'recall': recall,
            'f1': f1,
        }
    
    metrics['per_class'] = per_class_metrics
    
    print("\n性能指标:")
    print(f"  Accuracy: {metrics['accuracy']:.4f}")
    print(f"  Macro Precision: {metrics['macro_precision']:.4f}")
    print(f"  Macro Recall: {metrics['macro_recall']:.4f}")
    print(f"  Macro F1: {metrics['macro_f1']:.4f}")
    print(f"  Weighted F1: {metrics['weighted_f1']:.4f}")
    
    print("\n每类指标:")
    for label_name, class_metrics in per_class_metrics.items():
        print(f"  {label_name}:")
        print(f"    Precision: {class_metrics['precision']:.4f}")
        print(f"    Recall: {class_metrics['recall']:.4f}")
        print(f"    F1: {class_metrics['f1']:.4f}")
    
    print("\n分类报告:")
    print(classification_report(y_test, y_pred, 
                                target_names=['Low', 'Medium', 'High', 'Critical']))
    
    print("\n混淆矩阵:")
    print(confusion_matrix(y_test, y_pred))
    
    # 特征重要性
    feature_importance = []
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        top_indices = np.argsort(importances)[::-1][:20]
        if feature_names is not None and len(feature_names) == len(importances):
            feature_name_list = feature_names
        else:
            feature_name_list = [f"feature_{i}" for i in range(len(importances))]
        for idx in top_indices:
            feature_importance.append({
                'name': feature_name_list[idx] if idx < len(feature_name_list) else f"feature_{idx}",
                'importance': float(importances[idx])
            })
    
    return model, metrics, feature_importance


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python train_severity_model.py <config_json>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    print(f"加载配置文件: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # 读取配置
    csv_path = config['csv_path']
    model_type = config.get('model_type', 'XGBoost')
    use_smote = config.get('use_smote', False)  # 默认关闭SMOTE
    test_size = config.get('test_size', 0.2)
    random_state = config.get('random_state', 42)
    output_dir = config['output_dir']
    text_column = config.get('text_column', 'description_clean')
    max_features = config.get('max_features', 20000)
    
    print("=" * 60)
    print("Stage B: 训练 Severity 模型（4类严重度）")
    print("=" * 60)
    
    print("=" * 60)
    print("步骤1: 加载和预处理数据")
    print("=" * 60)
    
    # 加载数据
    df = load_cve_dataset(csv_path)
    
    # 预处理和构建4类标签
    df = preprocess_dataset_severity(df, text_column=text_column)
    
    # 过滤有效标签
    df_valid = df[df['severity_label'] != -1].copy()
    if len(df_valid) == 0:
        raise ValueError("没有有效的标签数据！")
    
    print(f"\n有效样本数: {len(df_valid)}")
    
    # 构建特征
    print("\n" + "=" * 60)
    print("步骤2: 特征工程")
    print("=" * 60)
    
    vectorizer, X, feature_names = build_feature_pipeline(
        df_valid, text_column=text_column, max_features=max_features
    )
    y = df_valid['severity_label'].values
    
    # 类别分布
    class_counts = np.bincount(y, minlength=4)
    print(f"\n类别分布:")
    for label_id in range(4):
        label_name = SEVERITY_LABELS[label_id]['name']
        count = class_counts[label_id]
        print(f"  {label_name} (label={label_id}): {count} ({count/len(y)*100:.2f}%)")
    
    # 训练测试集划分
    print("\n" + "=" * 60)
    print("步骤3: 数据集划分")
    print("=" * 60)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state,
        stratify=y if len(np.unique(y)) > 1 else None
    )
    
    print(f"训练集大小: {X_train.shape[0]}")
    print(f"测试集大小: {X_test.shape[0]}")
    
    # SMOTE处理（默认关闭，因为会放大域偏移）
    if use_smote and len(np.unique(y_train)) > 1:
        print("\n" + "=" * 60)
        print("步骤4: 应用SMOTE处理类别不平衡（可选）")
        print("=" * 60)
        
        n_minority = min([np.sum(y_train == i) for i in range(4)])
        k_neighbors = min(5, n_minority - 1) if n_minority > 1 else 1
        
        if k_neighbors > 0:
            try:
                smote = SMOTE(random_state=random_state, k_neighbors=k_neighbors)
                X_train, y_train = smote.fit_resample(X_train, y_train)
                print(f"SMOTE后训练集大小: {X_train.shape}, 类别分布: {np.bincount(y_train)}")
            except Exception as e:
                print(f"SMOTE失败: {e}，继续不使用SMOTE...")
        else:
            print("少数类样本太少，跳过SMOTE...")
    else:
        print("\n注意: SMOTE默认关闭（use_smote=False），因为会放大域偏移")
    
    # 训练模型
    print("\n" + "=" * 60)
    print("步骤5: 模型训练")
    print("=" * 60)
    
    model, metrics, feature_importance = train_severity_model(
        X_train, y_train, X_test, y_test,
        model_type=model_type, random_state=random_state,
        feature_names=feature_names
    )
    
    # 生成训练集预测（用于分析）
    print("\n生成训练集预测...")
    y_train_pred_proba = model.predict_proba(X_train)
    
    # 保存模型
    print("\n" + "=" * 60)
    print("步骤6: 保存模型")
    print("=" * 60)
    
    os.makedirs(output_dir, exist_ok=True)
    
    # 保存模型
    model_path = os.path.join(output_dir, 'model.joblib')
    joblib.dump(model, model_path)
    print(f"模型已保存: {model_path}")
    
    # 保存向量化器
    vectorizer_path = os.path.join(output_dir, 'vectorizer.joblib')
    joblib.dump(vectorizer, vectorizer_path)
    print(f"向量化器已保存: {vectorizer_path}")
    
    # 保存元数据
    metadata = {
        'model_type': model_type,
        'task': 'severity_classification_4class',
        'severity_labels': {
            str(k): v for k, v in SEVERITY_LABELS.items()
        },
        'params': {
            'use_smote': use_smote,
            'test_size': test_size,
            'random_state': random_state,
            'max_features': max_features,
        },
        'metrics': metrics,
        'feature_importance': feature_importance[:20],  # Top 20
        'n_features': max_features,
        'n_train_samples': X_train.shape[0],
        'n_test_samples': X_test.shape[0],
        'class_distribution': {
            f'class_{i}_{SEVERITY_LABELS[i]["name"]}': int(class_counts[i])
            for i in range(4)
        },
        'text_column': text_column,
        'trained_at': datetime.now().isoformat()
    }
    
    metadata_path = os.path.join(output_dir, 'metadata.json')
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"元数据已保存: {metadata_path}")
    
    # 保存训练集预测结果
    indices = np.arange(len(df_valid))
    train_indices, _ = train_test_split(
        indices, test_size=test_size, random_state=random_state,
        stratify=y if len(np.unique(y)) > 1 else None
    )
    df_train = df_valid.iloc[train_indices].copy()
    df_train['P(Low)'] = y_train_pred_proba[:, 0]
    df_train['P(Medium)'] = y_train_pred_proba[:, 1]
    df_train['P(High)'] = y_train_pred_proba[:, 2]
    df_train['P(Critical)'] = y_train_pred_proba[:, 3]
    df_train['Predicted'] = model.predict(X_train)
    df_train['Predicted_Name'] = df_train['Predicted'].apply(lambda x: SEVERITY_LABELS[x]['name'])
    
    training_predictions_path = os.path.join(output_dir, 'training_predictions.csv')
    output_cols = ['cve_id'] if 'cve_id' in df_train.columns else []
    output_cols.extend(['severity_label', 'P(Low)', 'P(Medium)', 'P(High)', 'P(Critical)', 'Predicted', 'Predicted_Name'])
    if 'cvss_base' in df_train.columns:
        output_cols.append('cvss_base')
    df_train[output_cols].to_csv(training_predictions_path, index=False)
    print(f"训练预测结果已保存: {training_predictions_path}")
    
    print("\n" + "=" * 60)
    print("训练完成！")
    print("=" * 60)
    print(f"模型输出目录: {output_dir}")
    print(f"\n模型能输出4类概率: P(Low), P(Medium), P(High), P(Critical)")


if __name__ == "__main__":
    main()

