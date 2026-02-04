"""
Stage A: 训练 Applicability 模型（支持 LR/XGB/RF 三种模型）
判断输入是否"漏洞相关/信息充分"

正类 (label=1): CVE描述文本（漏洞相关）
  数据源: ml-service/merged_json_table.csv (description_clean 列)

负类 (label=0): GitHub issues/PRs（非漏洞相关或信息不足）
  数据源: ml-service/negative_github_issues.csv (text 列)

用法:
    python train_applicability_model.py --model lr|xgb|rf [--max-pos N] [--max-neg N]

示例:
    python train_applicability_model.py --model xgb
    python train_applicability_model.py --model lr --max-pos 50000 --max-neg 10000
"""

import json
import sys
import os
import argparse
import subprocess
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, classification_report, confusion_matrix
)
from datetime import datetime

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print('警告: XGBoost 未安装，无法使用 --model xgb')

# 默认参数
DEFAULT_MAX_POS = 80000  # 可配置 50000/80000
DEFAULT_MAX_NEG = 10000  # 不足则全量
MAX_FEATURES = 20000
NGRAM_RANGE = (1, 2)
MIN_DF = 2
MAX_DF = 0.95
TEST_SIZE = 0.2
RANDOM_STATE = 42
SEED = 42


def load_cve_data(csv_path: str, max_samples: int) -> pd.DataFrame:
    """
    加载CVE数据（正类）
    
    Args:
        csv_path: CVE CSV文件路径
        max_samples: 最大采样数量
    
    Returns:
        DataFrame with 'text' and 'label' columns
    """
    print(f'\n加载CVE数据: {csv_path}')
    df = pd.read_csv(csv_path)
    
    # 过滤有效文本：去空、len>=20
    df_valid = df[
        df['description_clean'].notna() & 
        (df['description_clean'].astype(str).str.len() >= 20)
    ].copy()
    
    # 采样
    if len(df_valid) > max_samples:
        df_valid = df_valid.sample(n=max_samples, random_state=SEED)
    
    df_valid['text'] = df_valid['description_clean'].astype(str)
    df_valid['label'] = 1  # 正类：漏洞相关
    
    print(f'  加载 {len(df_valid)} 条CVE数据（正类）')
    
    return df_valid[['text', 'label']]


def load_github_data(csv_path: str, max_samples: int) -> pd.DataFrame:
    """
    加载GitHub数据（负类）
    
    Args:
        csv_path: GitHub CSV文件路径
        max_samples: 最大采样数量
    
    Returns:
        DataFrame with 'text' and 'label' columns
    """
    print(f'\n加载GitHub数据: {csv_path}')
    
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f'GitHub数据文件不存在: {csv_path}')
    
    df = pd.read_csv(csv_path)
    
    # 过滤有效文本：去空、len>=60
    df_valid = df[
        df['text'].notna() & 
        (df['text'].astype(str).str.len() >= 60)
    ].copy()
    
    # 采样（不足则全量）
    if len(df_valid) > max_samples:
        df_valid = df_valid.sample(n=max_samples, random_state=SEED)
    
    df_valid['label'] = 0  # 负类：非漏洞相关或信息不足
    df_valid['subclass'] = 'github'  # 标记子类
    
    print(f'  加载 {len(df_valid)} 条GitHub数据（负类）')
    
    return df_valid[['text', 'label', 'subclass']]


def load_augmented_negatives(data_aug_dir: Path, target_ratio: float = 1.8) -> pd.DataFrame:
    """
    加载增强的负类数据集
    
    Args:
        data_aug_dir: 数据增强目录路径
        target_ratio: 目标负类:正类比例
    
    Returns:
        DataFrame with 'text', 'label', 'subclass' columns
    """
    print(f'\n加载增强负类数据: {data_aug_dir}')
    
    datasets = {
        'noise': 'neg_noise.csv',
        'keyword_only': 'neg_keyword_only.csv',
        'patch_mitigation': 'neg_patch_mitigation.csv',
    }
    
    all_negatives = []
    
    for subclass, filename in datasets.items():
        csv_path = data_aug_dir / filename
        if not csv_path.exists():
            print(f'  警告: {filename} 不存在，跳过')
            continue
        
        df = pd.read_csv(csv_path)
        
        # 确保有text和label列
        if 'text' not in df.columns or 'label' not in df.columns:
            print(f'  警告: {filename} 格式不正确，跳过')
            continue
        
        # 过滤有效文本：去空、len>=15（比GitHub更宽松）
        df_valid = df[
            df['text'].notna() & 
            (df['text'].astype(str).str.len() >= 15)
        ].copy()
        
        df_valid['subclass'] = subclass
        all_negatives.append(df_valid[['text', 'label', 'subclass']])
        
        print(f'  加载 {len(df_valid)} 条{subclass}数据')
    
    if not all_negatives:
        return pd.DataFrame(columns=['text', 'label', 'subclass'])
    
    # 合并所有增强负类
    df_aug = pd.concat(all_negatives, ignore_index=True)
    print(f'  总计加载 {len(df_aug)} 条增强负类数据')
    
    return df_aug


def preprocess_text(text: str) -> str:
    """
    预处理文本（与训练时保持一致）
    
    Args:
        text: 原始文本
    
    Returns:
        处理后的文本
    """
    import re
    text_lower = str(text).lower()
    text_clean = re.sub(r'[^a-z0-9\s]', ' ', text_lower)
    text_clean = ' '.join(text_clean.split())
    return text_clean


def train_model_lr(X_train, y_train, X_test, y_test):
    """
    训练 LogisticRegression 模型
    
    Args:
        X_train: 训练特征
        y_train: 训练标签
        X_test: 测试特征
        y_test: 测试标签
    
    Returns:
        model: 训练好的模型
        metrics: 性能指标字典
    """
    print('\n训练 LogisticRegression 模型...')
    model = LogisticRegression(
        max_iter=4000,
        class_weight='balanced',
        C=0.5,
        random_state=RANDOM_STATE
    )
    
    model.fit(X_train, y_train)
    print('训练完成！')
    
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
        'pr_auc': float(average_precision_score(y_test, y_pred_proba) if len(np.unique(y_test)) > 1 else 0.0),
    }
    
    return model, metrics


def train_model_xgb(X_train, y_train, X_test, y_test, scale_pos_weight: float):
    """
    训练 XGBoost 模型
    
    Args:
        X_train: 训练特征
        y_train: 训练标签
        X_test: 测试特征
        y_test: 测试标签
        scale_pos_weight: 正类权重（neg_count/pos_count）
    
    Returns:
        model: 训练好的模型
        metrics: 性能指标字典
    """
    if not XGBOOST_AVAILABLE:
        raise ImportError('XGBoost 未安装，无法使用 --model xgb')
    
    print('\n训练 XGBoost 模型...')
    print(f'  scale_pos_weight: {scale_pos_weight:.4f}')
    
    model = xgb.XGBClassifier(
        objective='binary:logistic',
        n_estimators=600,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=1.0,
        scale_pos_weight=scale_pos_weight,
        random_state=RANDOM_STATE,
        eval_metric='logloss',
        use_label_encoder=False,
    )
    
    model.fit(X_train, y_train)
    print('训练完成！')
    
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
        'pr_auc': float(average_precision_score(y_test, y_pred_proba) if len(np.unique(y_test)) > 1 else 0.0),
    }
    
    return model, metrics


def train_model_rf(X_train, y_train, X_test, y_test):
    """
    训练 RandomForest 模型
    
    Args:
        X_train: 训练特征
        y_train: 训练标签
        X_test: 测试特征
        y_test: 测试标签
    
    Returns:
        model: 训练好的模型
        metrics: 性能指标字典
    """
    print('\n训练 RandomForest 模型...')
    model = RandomForestClassifier(
        n_estimators=800,
        class_weight='balanced_subsample',
        random_state=RANDOM_STATE,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    print('训练完成！')
    
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
        'pr_auc': float(average_precision_score(y_test, y_pred_proba) if len(np.unique(y_test)) > 1 else 0.0),
    }
    
    return model, metrics


def find_optimal_threshold(y_test, y_pred_proba, thresholds=None):
    """
    扫描阈值，找到最优的 app_threshold
    
    Args:
        y_test: 真实标签
        y_pred_proba: 预测概率
        thresholds: 阈值列表（默认 0.3-0.8，步长0.05）
    
    Returns:
        best_threshold: 最优阈值
        best_f1: 最优F1分数
    """
    if thresholds is None:
        thresholds = np.arange(0.3, 0.81, 0.05)
    
    best_threshold = 0.5
    best_f1 = 0.0
    
    for threshold in thresholds:
        y_pred = (y_pred_proba >= threshold).astype(int)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        if f1 > best_f1:
            best_f1 = f1
            best_threshold = threshold
    
    return best_threshold, best_f1


def register_model_to_db(model_id: str, model_path: str, model_type: str):
    """
    注册模型到数据库（调用 Node.js 脚本）
    
    Args:
        model_id: 模型ID
        model_path: 模型路径（相对于项目根目录）
        model_type: 模型类型
    """
    print(f'\n注册模型到数据库: {model_id}')
    
    # 查找 register-model.js 脚本
    script_paths = [
        Path(__file__).parent.parent / 'backend-node' / 'scripts' / 'register-model.js',
        Path(__file__).parent.parent.parent / 'backend-node' / 'scripts' / 'register-model.js',
    ]
    
    script_path = None
    for sp in script_paths:
        if sp.exists():
            script_path = sp
            break
    
    if not script_path:
        print('[WARNING] 未找到 register-model.js 脚本，跳过自动注册')
        print(f'请手动运行: node backend-node/scripts/register-model.js {model_path} {model_id}')
        return
    
    try:
        # 调用 Node.js 脚本（指定 UTF-8 编码以避免 Windows GBK 编码问题）
        result = subprocess.run(
            ['node', str(script_path), str(model_path), model_id],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',  # 遇到编码错误时替换而不是失败
            timeout=30
        )
        
        if result.returncode == 0:
            print(f'[PASS] 模型 {model_id} 注册成功')
            if result.stdout:
                print(result.stdout)
        else:
            print(f'[WARNING] 模型注册失败: {result.stderr}')
            print(f'请手动运行: node {script_path} {model_path} {model_id}')
    except subprocess.TimeoutExpired:
        print('[WARNING] 模型注册超时，请手动注册')
    except Exception as e:
        print(f'[WARNING] 模型注册出错: {e}')
        print(f'请手动运行: node {script_path} {model_path} {model_id}')


def train_applicability_model(
    model_type: str = 'xgb',
    max_pos: int = DEFAULT_MAX_POS,
    max_neg: int = DEFAULT_MAX_NEG,
    max_aug_neg: int = None,  # 增强负类最大采样数（None表示不限制）
    use_aug_negatives: bool = True,
    target_neg_ratio: float = 1.75,  # 目标负类:正类比例
    model_version: str = '002_aug'
):
    """
    训练Applicability模型
    
    Args:
        model_type: 模型类型 ('lr', 'xgb', 'rf')
        max_pos: 正类最大采样数
        max_neg: 负类最大采样数（GitHub负类）
        use_aug_negatives: 是否使用增强负类
        model_version: 模型版本号（用于输出目录）
    """
    print('=' * 60)
    print(f'Stage A: 训练 Applicability 模型 ({model_type.upper()})')
    print('=' * 60)
    
    # 路径配置
    cve_csv_path = Path(__file__).parent / 'merged_json_table.csv'
    github_csv_path = Path(__file__).parent / 'negative_github_issues.csv'
    data_aug_dir = Path(__file__).parent / 'data_aug'
    
    # 输出目录
    model_suffix = {
        'lr': 'lr',
        'xgb': 'xgb',
        'rf': 'rf',
    }[model_type]
    output_dir_path = Path(__file__).parent.parent / f'models/app_model_{model_version}_{model_suffix}'
    
    # 确保输出目录存在
    output_dir_path.mkdir(parents=True, exist_ok=True)
    
    print(f'\n配置:')
    print(f'  模型类型: {model_type.upper()}')
    print(f'  模型版本: {model_version}')
    print(f'  正类最大采样数: {max_pos}')
    print(f'  GitHub负类最大采样数: {max_neg}')
    print(f'  增强负类最大采样数: {max_aug_neg if max_aug_neg is not None else "不限制"}')
    print(f'  目标负类:正类比例: {target_neg_ratio}:1')
    print(f'  使用增强负类: {use_aug_negatives}')
    print(f'  输出目录: {output_dir_path}')
    
    # 加载数据
    print('\n' + '=' * 60)
    print('步骤1: 加载数据')
    print('=' * 60)
    
    df_cve = load_cve_data(str(cve_csv_path), max_pos)
    df_cve['subclass'] = 'cve'  # 标记正类
    
    df_github = load_github_data(str(github_csv_path), max_neg)
    
    # 加载增强负类
    df_aug = pd.DataFrame(columns=['text', 'label', 'subclass'])
    if use_aug_negatives:
        df_aug = load_augmented_negatives(data_aug_dir)
        
        # 如果指定了max_aug_neg，进行采样
        if max_aug_neg is not None and len(df_aug) > max_aug_neg:
            print(f'\n增强负类采样: {len(df_aug)} -> {max_aug_neg}')
            # 按子类分层采样
            df_aug = df_aug.groupby('subclass', group_keys=False).apply(
                lambda x: x.sample(
                    n=min(len(x), int(max_aug_neg * len(x) / len(df_aug)) + 1),
                    random_state=SEED
                )
            )
            # 如果还是太多，随机下采样
            if len(df_aug) > max_aug_neg:
                df_aug = df_aug.sample(n=max_aug_neg, random_state=SEED)
            print(f'  采样后: {len(df_aug)} 条')
    
    # 计算目标负类数量（保持负类:正类比例在1.5:1到2:1之间）
    pos_count = len(df_cve)
    target_neg_ratio = 1.75  # 目标比例
    target_neg_count = int(pos_count * target_neg_ratio)
    
    # 合并GitHub负类和增强负类
    github_count = len(df_github)
    aug_count = len(df_aug)
    total_neg_count = github_count + aug_count
    
    print(f'\n负类统计:')
    print(f'  GitHub负类: {github_count}')
    print(f'  增强负类: {aug_count}')
    print(f'  总负类: {total_neg_count}')
    print(f'  目标负类数（比例{target_neg_ratio}:1）: {target_neg_count}')
    
    # 如果总负类超过目标，进行分层下采样
    if total_neg_count > target_neg_count and aug_count > 0:
        # 保留所有GitHub负类，下采样增强负类
        keep_github = github_count
        need_aug = target_neg_count - keep_github
        
        if need_aug > 0 and aug_count > need_aug:
            # 按子类分层采样
            df_aug_sampled = df_aug.groupby('subclass', group_keys=False).apply(
                lambda x: x.sample(
                    n=min(len(x), int(need_aug * len(x) / aug_count) + 1),
                    random_state=SEED
                )
            )
            # 如果还是太多，随机下采样
            if len(df_aug_sampled) > need_aug:
                df_aug_sampled = df_aug_sampled.sample(n=need_aug, random_state=SEED)
            df_aug = df_aug_sampled
            print(f'  下采样后增强负类: {len(df_aug)}')
    
    # 合并所有负类
    df_negatives = pd.concat([df_github, df_aug], ignore_index=True)
    
    # 统计子类分布
    subclass_counts = df_negatives['subclass'].value_counts().to_dict()
    print(f'\n负类子类分布:')
    for subclass, count in subclass_counts.items():
        print(f'  {subclass}: {count}')
    
    # 合并正类和负类
    df_all = pd.concat([df_cve, df_negatives], ignore_index=True)
    
    print(f'\n总数据量: {len(df_all)}')
    print(f'  正类 (label=1): {len(df_all[df_all["label"] == 1])}')
    print(f'  负类 (label=0): {len(df_all[df_all["label"] == 0])}')
    
    # 计算 scale_pos_weight（用于 XGBoost）
    pos_count = len(df_all[df_all['label'] == 1])
    neg_count = len(df_all[df_all['label'] == 0])
    scale_pos_weight = neg_count / pos_count if pos_count > 0 else 1.0
    
    # 保存数据集组成统计
    dataset_stats = {
        'total_samples': len(df_all),
        'positive_count': int(pos_count),
        'negative_count': int(neg_count),
        'negative_positive_ratio': float(neg_count / pos_count) if pos_count > 0 else 0.0,
        'subclass_distribution': {
            'positive': {'cve': int(pos_count)},
            'negative': {k: int(v) for k, v in subclass_counts.items()}
        },
        'use_augmented_negatives': use_aug_negatives,
        'model_version': model_version,
    }
    
    stats_path = output_dir_path / 'dataset_stats.json'
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(dataset_stats, f, indent=2, ensure_ascii=False)
    print(f'\n数据集统计已保存: {stats_path}')
    
    # 特征工程
    print('\n' + '=' * 60)
    print('步骤2: 特征工程')
    print('=' * 60)
    
    # 预处理文本
    processed_texts = [preprocess_text(text) for text in df_all['text']]
    
    # TF-IDF向量化
    vectorizer = TfidfVectorizer(
        max_features=MAX_FEATURES,
        stop_words='english',
        ngram_range=NGRAM_RANGE,
        min_df=MIN_DF,
        max_df=MAX_DF,
        lowercase=True
    )
    
    X = vectorizer.fit_transform(processed_texts)
    y = df_all['label'].values
    
    print(f'特征矩阵形状: {X.shape}')
    print(f'特征数量: {len(vectorizer.get_feature_names_out())}')
    
    # 数据划分
    print('\n' + '=' * 60)
    print('步骤3: 数据集划分')
    print('=' * 60)
    
    # 先获取索引，用于后续保存训练集预测结果
    indices = np.arange(len(df_all))
    X_train, X_test, y_train, y_test, train_indices, test_indices = train_test_split(
        X, y, indices,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y
    )
    
    print(f'训练集大小: {X_train.shape[0]}')
    print(f'测试集大小: {X_test.shape[0]}')
    
    # 模型训练
    print('\n' + '=' * 60)
    print('步骤4: 模型训练')
    print('=' * 60)
    
    if model_type == 'lr':
        model, metrics = train_model_lr(X_train, y_train, X_test, y_test)
    elif model_type == 'xgb':
        model, metrics = train_model_xgb(X_train, y_train, X_test, y_test, scale_pos_weight)
    elif model_type == 'rf':
        model, metrics = train_model_rf(X_train, y_train, X_test, y_test)
    else:
        raise ValueError(f'不支持的模型类型: {model_type}')
    
    # 模型评估
    print('\n' + '=' * 60)
    print('步骤5: 模型评估')
    print('=' * 60)
    
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    print('\n性能指标:')
    for key, value in metrics.items():
        print(f'  {key}: {value:.4f}')
    
    print('\n分类报告:')
    print(classification_report(y_test, y_pred, target_names=['Negative', 'Positive']))
    
    print('\n混淆矩阵:')
    print(confusion_matrix(y_test, y_pred))
    
    # 扫描最优阈值
    app_threshold, best_f1 = find_optimal_threshold(y_test, y_pred_proba)
    print(f'\n最优阈值 (app_threshold): {app_threshold:.3f} (F1: {best_f1:.4f})')
    
    # 保存模型
    print('\n' + '=' * 60)
    print('步骤6: 保存模型')
    print('=' * 60)
    
    # 保存模型文件
    model_path = output_dir_path / 'model.joblib'
    joblib.dump(model, model_path)
    print(f'模型已保存: {model_path}')
    
    # 保存向量化器
    vectorizer_path = output_dir_path / 'vectorizer.joblib'
    joblib.dump(vectorizer, vectorizer_path)
    print(f'向量化器已保存: {vectorizer_path}')
    
    # 保存元数据
    metadata = {
        'model_type': model_type.upper(),  # 用于数据库注册的类型（算法名称：XGB/RF/LR）
        'model_algorithm': model_type.upper(),  # 实际算法类型（LR/XGB/RF）
        'model_function': 'applicability',  # 模型功能类型（applicability/severity）
        'task': 'applicability_classification',
        'params': {
            'max_features': MAX_FEATURES,
            'ngram_range': list(NGRAM_RANGE),
            'min_df': MIN_DF,
            'max_df': MAX_DF,
            'test_size': TEST_SIZE,
            'random_state': RANDOM_STATE,
        },
        'model_params': {},
        'metrics': metrics,
        'app_threshold': app_threshold,
        'n_train_samples': int(X_train.shape[0]),
        'n_test_samples': int(X_test.shape[0]),
        'class_distribution': {
            'class_0_count': int(neg_count),
            'class_1_count': int(pos_count),
            'class_0_percentage': float(neg_count / len(df_all) * 100),
            'class_1_percentage': float(pos_count / len(df_all) * 100),
        },
        'subclass_distribution': dataset_stats['subclass_distribution'],
        'data_sources': {
            'positive': 'merged_json_table.csv (CVE descriptions)',
            'negative': 'negative_github_issues.csv (GitHub issues/PRs)',
            'augmented_negatives': 'data_aug/ (noise, keyword_only, patch_mitigation)' if use_aug_negatives else None,
            'max_pos_samples': max_pos,
            'max_neg_samples': max_neg,
            'use_augmented_negatives': use_aug_negatives,
        },
        'model_version': model_version,
        'trained_at': datetime.now().isoformat()
    }
    
    # 添加模型特定参数
    if model_type == 'lr':
        metadata['model_params'] = {
            'max_iter': 4000,
            'class_weight': 'balanced',
            'C': 0.5,
        }
    elif model_type == 'xgb':
        metadata['model_params'] = {
            'objective': 'binary:logistic',
            'n_estimators': 600,
            'max_depth': 6,
            'learning_rate': 0.05,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'reg_lambda': 1.0,
        }
        metadata['scale_pos_weight'] = float(scale_pos_weight)
    elif model_type == 'rf':
        metadata['model_params'] = {
            'n_estimators': 800,
            'class_weight': 'balanced_subsample',
        }
    
    metadata_path = output_dir_path / 'metadata.json'
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f'元数据已保存: {metadata_path}')
    
    # 保存测试集预测结果
    y_test_pred_proba = model.predict_proba(X_test)[:, 1]
    eval_predictions = pd.DataFrame({
        'text': df_all.iloc[test_indices]['text'].values,
        'label': y_test,
        'p_applicable': y_test_pred_proba,
        'predicted': y_pred,
    })
    
    eval_predictions_path = output_dir_path / 'eval_predictions.csv'
    eval_predictions.to_csv(eval_predictions_path, index=False)
    print(f'测试集预测结果已保存: {eval_predictions_path}')
    
    print('\n' + '=' * 60)
    print('训练完成！')
    print('=' * 60)
    print(f'模型输出目录: {output_dir_path}')
    print(f'\n建议阈值 (app_threshold): {app_threshold:.3f}')
    print(f'ROC-AUC: {metrics["roc_auc"]:.4f}')
    print(f'PR-AUC: {metrics["pr_auc"]:.4f}')
    
    # 注册模型到数据库
    model_id = f'app_model_{model_version}_{model_suffix}'
    model_path_relative = f'models/app_model_{model_version}_{model_suffix}'
    register_model_to_db(model_id, model_path_relative, model_type.upper())
    
    # 验收检查
    if metrics['roc_auc'] >= 0.85:
        print('\n[PASS] 验收通过: ROC-AUC >= 0.85')
        return True
    else:
        print('\n[FAIL] 验收失败: ROC-AUC < 0.85')
        print('建议:')
        print('  1. 检查GitHub文本质量')
        print('  2. 检查是否混入了安全相关的issue作为负类')
        print('  3. 增加负类中"明显非安全"样本的比例')
        return False


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='训练Applicability模型（支持LR/XGB/RF）')
    parser.add_argument('--model', type=str, default='xgb', choices=['lr', 'xgb', 'rf'],
                        help='模型类型: lr (LogisticRegression), xgb (XGBoost), rf (RandomForest)')
    parser.add_argument('--max-pos', type=int, default=DEFAULT_MAX_POS,
                        help=f'正类最大采样数（默认: {DEFAULT_MAX_POS}）')
    parser.add_argument('--max-neg', type=int, default=DEFAULT_MAX_NEG,
                        help=f'GitHub负类最大采样数（默认: {DEFAULT_MAX_NEG}）')
    parser.add_argument('--max-aug-neg', type=int, default=None,
                        help='增强负类最大采样数（默认: None，不限制）')
    parser.add_argument('--target-neg-ratio', type=float, default=1.75,
                        help='目标负类:正类比例（默认: 1.75，即1.75:1）')
    parser.add_argument('--use-aug-negatives', action='store_true', default=True,
                        help='使用增强负类数据（默认: True）')
    parser.add_argument('--no-aug-negatives', dest='use_aug_negatives', action='store_false',
                        help='不使用增强负类数据')
    parser.add_argument('--model-version', type=str, default='002_aug',
                        help='模型版本号（默认: 002_aug）')
    
    args = parser.parse_args()
    
    if args.model == 'xgb' and not XGBOOST_AVAILABLE:
        print('错误: XGBoost 未安装，无法使用 --model xgb')
        print('请安装: pip install xgboost')
        sys.exit(1)
    
    try:
        success = train_applicability_model(
            model_type=args.model,
            max_pos=args.max_pos,
            max_neg=args.max_neg,
            max_aug_neg=args.max_aug_neg,
            target_neg_ratio=args.target_neg_ratio,
            use_aug_negatives=args.use_aug_negatives,
            model_version=args.model_version
        )
        if not success:
            print('\n[WARNING] 警告: 验收未通过')
            sys.exit(1)
    except Exception as e:
        print(f'\n[ERROR] 错误: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
