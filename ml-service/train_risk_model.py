"""
风险导向的漏洞预测模型训练脚本
支持XGBoost和Random Forest，包含概率校准和SMOTE处理
"""

import json
import sys
import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    roc_auc_score, classification_report, confusion_matrix
)
from imblearn.over_sampling import SMOTE
import xgboost as xgb
from datetime import datetime

# 导入自定义模块
from data_exploration import load_cve_dataset, preprocess_dataset, save_preprocessing_report
from risk import calculate_risk_score, get_risk_level


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


def train_model(X_train, y_train, X_test, y_test, model_type='XGBoost', 
                calibrate=True, random_state=42):
    """
    训练模型
    
    Args:
        X_train: 训练特征
        y_train: 训练标签
        X_test: 测试特征
        y_test: 测试标签
        model_type: 模型类型 ('XGBoost' 或 'RandomForest')
        calibrate: 是否进行概率校准
        random_state: 随机种子
    
    Returns:
        model: 训练好的模型
        metrics: 性能指标字典
        feature_importance: 特征重要性列表
    """
    print(f"\n训练{model_type}模型...")
    
    # 构建基础模型
    if model_type == 'XGBoost':
        base_model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=random_state,
            eval_metric='logloss',
            use_label_encoder=False,
            scale_pos_weight=len(y_train[y_train == 0]) / len(y_train[y_train == 1]) if np.sum(y_train) > 0 else 1.0
        )
    elif model_type == 'RandomForest':
        base_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=None,
            random_state=random_state,
            n_jobs=-1,
            class_weight='balanced'
        )
    else:
        raise ValueError(f"不支持的模型类型: {model_type}")
    
    # 概率校准
    if calibrate:
        print("应用概率校准 (isotonic)...")
        model = CalibratedClassifierCV(base_model, method='isotonic', cv=3)
    else:
        model = base_model
    
    # 训练
    print("开始训练...")
    model.fit(X_train, y_train)
    print("训练完成！")
    
    # 预测
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # 计算指标
    metrics = {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred, zero_division=0)),
        'recall': float(recall_score(y_test, y_pred, zero_division=0)),
        'f1': float(f1_score(y_test, y_pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_test, y_pred_proba) if len(np.unique(y_test)) > 1 else 0.0),
    }
    
    print("\n性能指标:")
    for key, value in metrics.items():
        print(f"  {key}: {value:.4f}")
    
    # 特征重要性
    feature_importance = []
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
    elif hasattr(model, 'base_estimator') and hasattr(model.base_estimator, 'feature_importances_'):
        importances = model.base_estimator.feature_importances_
    elif hasattr(model, 'calibrated_classifiers_'):
        # 对于CalibratedClassifierCV，取第一个校准分类器的特征重要性
        if len(model.calibrated_classifiers_) > 0:
            # 在较新版本的scikit-learn中，使用estimator而不是base_estimator
            calibrated_clf = model.calibrated_classifiers_[0]
            base_est = getattr(calibrated_clf, 'estimator', None) or getattr(calibrated_clf, 'base_estimator', None)
            if base_est is not None and hasattr(base_est, 'feature_importances_'):
                importances = base_est.feature_importances_
            else:
                importances = None
        else:
            importances = None
    else:
        importances = None
    
    if importances is not None:
        # 获取top特征
        top_indices = np.argsort(importances)[::-1][:20]
        feature_names = [f"feature_{i}" for i in range(len(importances))]
        for idx in top_indices:
            feature_importance.append({
                'name': feature_names[idx],
                'importance': float(importances[idx])
            })
    
    return model, metrics, feature_importance


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python train_risk_model.py <config_json>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    print(f"加载配置文件: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # 读取配置
    csv_path = config['csv_path']
    model_type = config.get('model_type', 'XGBoost')
    use_smote = config.get('use_smote', False)
    test_size = config.get('test_size', 0.2)
    random_state = config.get('random_state', 42)
    output_dir = config['output_dir']
    alpha = config.get('alpha', 0.6)
    text_column = config.get('text_column', 'description_clean')
    max_features = config.get('max_features', 20000)
    calibrate = config.get('calibrate', True)
    
    print("=" * 60)
    print("步骤1: 加载和预处理数据")
    print("=" * 60)
    
    # 加载数据
    df = load_cve_dataset(csv_path)
    
    # 预处理和构建标签
    df = preprocess_dataset(df, text_column=text_column)
    
    # 过滤有效标签
    df_valid = df[df['y'] != -1].copy()
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
    y = df_valid['y'].values
    
    # 类别分布
    class_counts = np.bincount(y)
    print(f"\n类别分布:")
    print(f"  低风险 (y=0): {class_counts[0]} ({class_counts[0]/len(y)*100:.2f}%)")
    print(f"  高风险 (y=1): {class_counts[1]} ({class_counts[1]/len(y)*100:.2f}%)")
    imbalance_ratio = class_counts[0] / class_counts[1] if class_counts[1] > 0 else 0
    print(f"  不平衡比例: {imbalance_ratio:.2f}:1")
    
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
    
    # 保存原始训练集（SMOTE之前），用于后续预测和保存结果
    # 获取训练集在原始数据中的索引
    # 使用相同的参数重新split索引数组以获取训练集索引
    indices = np.arange(len(df_valid))
    train_indices, _ = train_test_split(
        indices, test_size=test_size, random_state=random_state,
        stratify=y if len(np.unique(y)) > 1 else None
    )
    X_train_original = X_train.copy()
    y_train_original = y_train.copy()
    original_train_size = X_train.shape[0]
    
    # SMOTE处理
    if use_smote and len(np.unique(y_train)) > 1:
        print("\n" + "=" * 60)
        print("步骤4: 应用SMOTE处理类别不平衡")
        print("=" * 60)
        
        n_minority = np.sum(y_train == 1)
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
    
    # 训练模型
    print("\n" + "=" * 60)
    print("步骤5: 模型训练")
    print("=" * 60)
    
    model, metrics, feature_importance = train_model(
        X_train, y_train, X_test, y_test,
        model_type=model_type, calibrate=calibrate, random_state=random_state
    )
    
    # 生成训练集预测（用于分析）
    # 注意：只对原始训练集（SMOTE之前）进行预测，因为SMOTE生成的合成样本没有对应的原始数据
    print("\n生成训练集预测...")
    # 对原始训练集（SMOTE之前）进行预测
    y_train_pred_proba = model.predict_proba(X_train_original)[:, 1]
    
    # 计算风险评分
    print("\n计算风险评分...")
    # 使用原始训练集索引创建DataFrame
    df_train = df_valid.iloc[train_indices].copy()
    df_train['P(vuln)'] = y_train_pred_proba
    df_train['RiskScore'] = df_train.apply(
        lambda row: calculate_risk_score(
            row['P(vuln)'], 
            row.get('cvss_base', None), 
            alpha=alpha
        ), axis=1
    )
    df_train['RiskLevel'] = df_train['RiskScore'].apply(get_risk_level)
    
    # 保存模型和预处理器
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
        'params': {
            'use_smote': use_smote,
            'test_size': test_size,
            'random_state': random_state,
            'calibrate': calibrate,
            'max_features': max_features,
            'alpha': alpha
        },
        'metrics': metrics,
        'feature_importance': feature_importance[:20],  # Top 20
        'n_features': max_features,
        'n_train_samples': X_train.shape[0],
        'n_test_samples': X_test.shape[0],
        'class_distribution': {
            'class_0_count': int(class_counts[0]),
            'class_1_count': int(class_counts[1]),
            'class_0_percentage': float(class_counts[0]/len(y)*100),
            'class_1_percentage': float(class_counts[1]/len(y)*100),
            'total_samples': int(len(y)),
            'imbalance_ratio': float(imbalance_ratio)
        },
        'text_column': text_column,
        'trained_at': datetime.now().isoformat()
    }
    
    metadata_path = os.path.join(output_dir, 'metadata.json')
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"元数据已保存: {metadata_path}")
    
    # 保存预处理报告
    preprocessing_report_path = os.path.join(output_dir, 'preprocessing_report.json')
    save_preprocessing_report(df_valid, preprocessing_report_path)
    
    # 保存训练预测结果
    training_predictions_path = os.path.join(output_dir, 'training_predictions.csv')
    output_cols = ['cve_id'] if 'cve_id' in df_train.columns else []
    output_cols.extend(['P(vuln)', 'RiskScore', 'RiskLevel'])
    if 'cvss_base' in df_train.columns:
        output_cols.append('cvss_base')
    df_train[output_cols].to_csv(training_predictions_path, index=False)
    print(f"训练预测结果已保存: {training_predictions_path}")
    
    print("\n" + "=" * 60)
    print("训练完成！")
    print("=" * 60)
    print(f"模型输出目录: {output_dir}")


if __name__ == "__main__":
    main()







