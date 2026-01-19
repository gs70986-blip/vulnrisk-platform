"""
Training script for vulnerability prediction models.
Supports RandomForest and XGBoost with optional SMOTE.
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
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from imblearn.over_sampling import SMOTE
import xgboost as xgb

# Default risk calculation parameters
DEFAULT_ALPHA = 0.6
DEFAULT_BETA = 0.4


def preprocess_text(texts, max_features=20000):
    """
    Preprocess text using TF-IDF.
    
    Args:
        texts: List of text strings
        max_features: Maximum number of features for TF-IDF
    
    Returns:
        vectorizer: Fitted TfidfVectorizer
        X_text: Transformed feature matrix
    """
    # Clean and lowercase text
    processed_texts = []
    for text in texts:
        if pd.isna(text):
            processed_texts.append("")
            continue
        # Lowercase
        text_lower = str(text).lower()
        # Remove special characters (keep alphanumeric and spaces)
        import re
        text_clean = re.sub(r'[^a-z0-9\s]', ' ', text_lower)
        # Remove extra whitespace
        text_clean = ' '.join(text_clean.split())
        processed_texts.append(text_clean)
    
    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(
        max_features=max_features,
        stop_words='english',
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95
    )
    
    X_text = vectorizer.fit_transform(processed_texts)
    
    return vectorizer, X_text


def load_and_prepare_data(dataset_path):
    """
    Load dataset and prepare features and labels.
    
    Args:
        dataset_path: Path to JSON file with dataset
    
    Returns:
        X: Feature matrix
        y: Labels
        vectorizer: Text vectorizer
        feature_names: List of feature names
    """
    # Load data
    with open(dataset_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    df = pd.DataFrame(data)
    
    # Validate required fields
    if 'text_description' not in df.columns:
        raise ValueError("Missing required field: text_description")
    if 'label' not in df.columns:
        raise ValueError("Missing required field: label (for training)")
    
    # Extract text features
    texts = df['text_description'].fillna("").tolist()
    vectorizer, X_text = preprocess_text(texts)
    
    # Convert to dense array if needed (or keep sparse for efficiency)
    if X_text.shape[1] < 1000:
        X_text = X_text.toarray()
    
    # Extract labels
    y = df['label'].values
    
    # Ensure binary labels
    y = np.where(y > 0.5, 1, 0)
    
    # Get feature names
    if hasattr(vectorizer, 'get_feature_names_out'):
        feature_names = vectorizer.get_feature_names_out().tolist()
    else:
        feature_names = vectorizer.get_feature_names().tolist()
    
    return X_text, y, vectorizer, feature_names, df


def train_random_forest(X_train, y_train, X_test, y_test, n_estimators=100, max_depth=None, random_state=42):
    """Train RandomForest model."""
    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
        n_jobs=-1,
        class_weight='balanced'
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    metrics = {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred, zero_division=0)),
        'recall': float(recall_score(y_test, y_pred, zero_division=0)),
        'f1': float(f1_score(y_test, y_pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_test, y_pred_proba) if len(np.unique(y_test)) > 1 else 0.0),
    }
    
    # Feature importance
    if hasattr(model, 'feature_importances_'):
        feature_importance = model.feature_importances_.tolist()
    else:
        feature_importance = []
    
    return model, metrics, feature_importance


def train_xgboost(X_train, y_train, X_test, y_test, n_estimators=100, max_depth=6, random_state=42):
    """Train XGBoost model."""
    model = xgb.XGBClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
        eval_metric='logloss',
        use_label_encoder=False,
        scale_pos_weight=len(y_train[y_train == 0]) / len(y_train[y_train == 1]) if np.sum(y_train) > 0 else 1.0
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    metrics = {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred, zero_division=0)),
        'recall': float(recall_score(y_test, y_pred, zero_division=0)),
        'f1': float(f1_score(y_test, y_pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_test, y_pred_proba) if len(np.unique(y_test)) > 1 else 0.0),
    }
    
    # Feature importance
    if hasattr(model, 'feature_importances_'):
        feature_importance = model.feature_importances_.tolist()
    else:
        feature_importance = []
    
    return model, metrics, feature_importance


def main():
    """Main training function."""
    if len(sys.argv) < 2:
        print("Usage: python train.py <config_json>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    dataset_path = config['dataset_path']
    model_type = config['model_type']
    use_smote = config.get('use_smote', False)
    test_size = config.get('test_size', 0.2)
    random_state = config.get('random_state', 42)
    output_dir = config['output_dir']
    
    # Load and prepare data
    print(f"Loading data from {dataset_path}...")
    X, y, vectorizer, feature_names, df = load_and_prepare_data(dataset_path)
    
    print(f"Data shape: {X.shape}, Labels: {np.bincount(y)}")
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y if len(np.unique(y)) > 1 else None
    )
    
    # Apply SMOTE if requested
    if use_smote and len(np.unique(y_train)) > 1:
        print("Applying SMOTE...")
        smote = SMOTE(random_state=random_state, k_neighbors=min(5, len(y_train[y_train == 1]) - 1))
        try:
            X_train, y_train = smote.fit_resample(X_train, y_train)
            print(f"After SMOTE - Data shape: {X_train.shape}, Labels: {np.bincount(y_train)}")
        except Exception as e:
            print(f"SMOTE failed: {e}. Continuing without SMOTE...")
    
    # Train model
    print(f"Training {model_type} model...")
    if model_type == 'RandomForest':
        model, metrics, feature_importance = train_random_forest(
            X_train, y_train, X_test, y_test, random_state=random_state
        )
    elif model_type == 'XGBoost':
        model, metrics, feature_importance = train_xgboost(
            X_train, y_train, X_test, y_test, random_state=random_state
        )
    else:
        raise ValueError(f"Unknown model type: {model_type}")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Save model and vectorizer
    model_path = os.path.join(output_dir, 'model.joblib')
    vectorizer_path = os.path.join(output_dir, 'vectorizer.joblib')
    
    joblib.dump(model, model_path)
    joblib.dump(vectorizer, vectorizer_path)
    
    # Prepare metadata
    # Get top features (if feature importance available)
    top_features = []
    if feature_importance and len(feature_importance) > 0:
        # Get top 20 features
        top_indices = np.argsort(feature_importance)[-20:][::-1]
        top_features = [
            {'name': feature_names[i] if i < len(feature_names) else f'feature_{i}', 
             'importance': float(feature_importance[i])}
            for i in top_indices
        ]
    
    metadata = {
        'model_type': model_type,
        'params': {
            'use_smote': use_smote,
            'test_size': test_size,
            'random_state': random_state,
        },
        'metrics': metrics,
        'feature_importance': top_features,
        'n_features': X.shape[1],
        'n_train_samples': len(X_train),
        'n_test_samples': len(X_test),
        'dataset_path': dataset_path,  # 保存原始训练数据集路径，用于 CVSS 相似度估算
    }
    
    metadata_path = os.path.join(output_dir, 'metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Model saved to {model_path}")
    print(f"Metrics: {metrics}")
    print(f"Top 5 features: {[f['name'] for f in top_features[:5]]}")
    
    # Output results as JSON for API
    result = {
        'model_path': model_path,
        'vectorizer_path': vectorizer_path,
        'metadata': metadata,
    }
    
    print(json.dumps(result))


if __name__ == '__main__':
    main()















