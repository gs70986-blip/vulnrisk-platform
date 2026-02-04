# Stage A Applicability模型重训实施总结

## 概述

本次重训旨在提高Stage A模型的鲁棒性，通过添加三个新的负类子集来增强模型对OOD（Out-of-Distribution）数据的处理能力。

## 实施步骤

### 1. 创建增强负类数据集生成脚本

**文件**: `ml-service/generate_aug_negatives.py`

**功能**:
- 生成三个负类数据集：
  1. `neg_noise.csv` (1200条): 噪声/闲聊/日志类文本
  2. `neg_keyword_only.csv` (1200条): 仅包含安全关键词但无上下文的文本
  3. `neg_patch_mitigation.csv` (1200条): 补丁/缓解风格文本

**输出目录**: `ml-service/data_aug/`

**随机种子**: 42（确保可重现性）

### 2. 修改训练脚本

**文件**: `ml-service/train_applicability_model.py`

**主要修改**:
- 新增 `load_augmented_negatives()` 函数：加载三个增强负类数据集
- 修改 `load_github_data()` 函数：添加 `subclass` 标记
- 修改 `train_applicability_model()` 函数：
  - 新增参数：`use_aug_negatives` (默认True), `model_version` (默认'002_aug')
  - 集成增强负类加载和采样逻辑
  - 保持负类:正类比例在1.5:1到2:1之间
  - 按子类分层下采样（如果超过目标数量）
  - 保存数据集组成统计到 `dataset_stats.json`
  - 更新metadata以包含子类分布信息

**新增CLI参数**:
- `--use-aug-negatives`: 使用增强负类（默认True）
- `--no-aug-negatives`: 不使用增强负类
- `--model-version`: 模型版本号（默认'002_aug'）

**输出目录**: `models/app_model_002_aug_{lr|xgb|rf}/`

### 3. 创建OOD评估脚本

**文件**: `ml-service/eval_applicability_ood.py`

**功能**:
- In-domain评估：CVE vs 原始GitHub issues测试集
- OOD评估：CVE positives vs 每个负类子类
  - Noise negatives
  - Keyword-only negatives
  - Patch/mitigation negatives

**评估指标**:
- 准确率、精确率、召回率、F1分数
- False Positive Rate (FPR) - 负类被错误标记为applicable的比例
- AUROC、AUPRC
- 混淆矩阵

**输出文件**:
- `ood_eval_report.json`: JSON格式的详细评估结果
- `ood_eval_report.md`: 人类可读的Markdown报告
- `ood_eval_{set_name}_predictions.csv`: 每个评估集的预测结果

### 4. 更新运行时模型路径

**文件**: `ml-service/app.py`

**修改**:
- 更新默认applicability模型路径选择逻辑
- 优先使用增强版本（`app_model_002_aug_xgb`）
- 如果增强版本不存在，回退到旧版本（`app_model_001`）
- 保持向后兼容性

### 5. 创建快速验证脚本

**文件**: `ml-service/quick_sanity_check.py`

**功能**:
- 测试5个示例字符串：
  1. "hello hello, nice to meet you" → 预期: not applicable
  2. "TODAY IS A GOOD DAY XSS" → 预期: not applicable 或低概率
  3. "Fix: Prevent command injection..." → 预期: not applicable 或可靠性降级
  4. 正常GitHub工程问题 → 预期: 取决于内容
  5. CVE漏洞描述 → 预期: applicable

## 文件清单

### 新创建的文件

1. `ml-service/generate_aug_negatives.py` - 增强负类数据集生成脚本
2. `ml-service/data_aug/neg_noise.csv` - 噪声数据集（1200条）
3. `ml-service/data_aug/neg_keyword_only.csv` - 关键词仅数据集（1200条）
4. `ml-service/data_aug/neg_patch_mitigation.csv` - 补丁/缓解数据集（1200条）
5. `ml-service/data_aug/generation_stats.json` - 生成统计信息
6. `ml-service/data_aug/README.md` - 数据集说明文档
7. `ml-service/eval_applicability_ood.py` - OOD评估脚本
8. `ml-service/quick_sanity_check.py` - 快速验证脚本

### 修改的文件

1. `ml-service/train_applicability_model.py` - 训练脚本（支持增强负类）
2. `ml-service/app.py` - 运行时模型路径更新

## 使用说明

### 1. 生成增强负类数据集

```bash
cd ml-service
python generate_aug_negatives.py
```

### 2. 训练新模型

```bash
# 使用XGBoost（推荐）
python train_applicability_model.py --model xgb --model-version 002_aug

# 使用RandomForest
python train_applicability_model.py --model rf --model-version 002_aug

# 使用LogisticRegression
python train_applicability_model.py --model lr --model-version 002_aug

# 不使用增强负类（仅用于对比）
python train_applicability_model.py --model xgb --no-aug-negatives --model-version 001
```

### 3. 运行OOD评估

```bash
# 评估XGBoost模型
python eval_applicability_ood.py models/app_model_002_aug_xgb

# 评估RandomForest模型
python eval_applicability_ood.py models/app_model_002_aug_rf

# 评估LogisticRegression模型
python eval_applicability_ood.py models/app_model_002_aug_lr
```

### 4. 快速验证

```bash
python quick_sanity_check.py
```

## 模型输出目录

训练后的模型保存在：
- `models/app_model_002_aug_xgb/` (XGBoost)
- `models/app_model_002_aug_rf/` (RandomForest)
- `models/app_model_002_aug_lr/` (LogisticRegression)

每个目录包含：
- `model.joblib` - 训练好的模型
- `vectorizer.joblib` - TF-IDF向量化器
- `metadata.json` - 模型元数据（包含子类分布、训练参数等）
- `dataset_stats.json` - 数据集组成统计
- `eval_predictions.csv` - 测试集预测结果
- `ood_eval_report.json` - OOD评估JSON报告（运行评估后生成）
- `ood_eval_report.md` - OOD评估Markdown报告（运行评估后生成）
- `ood_eval_*_predictions.csv` - 各评估集的预测结果（运行评估后生成）

## OOD评估报告位置

评估报告保存在模型输出目录中：
- `models/app_model_002_aug_{lr|xgb|rf}/ood_eval_report.json`
- `models/app_model_002_aug_{lr|xgb|rf}/ood_eval_report.md`

## 关键特性

1. **向后兼容**: 旧模型（app_model_001）仍然可用
2. **自动回退**: 如果新模型不存在，自动使用旧模型
3. **子类追踪**: 所有负类样本都标记了子类（github, noise, keyword_only, patch_mitigation）
4. **可重现性**: 使用固定随机种子（42）确保结果可重现
5. **分层采样**: 按子类分层下采样，保持子类分布平衡

## 论文答辩适用性

本次重训提供了：
1. **鲁棒性评估**: OOD评估报告展示了模型在分布外数据上的表现
2. **可解释性**: 子类分布统计帮助理解模型训练数据组成
3. **对比分析**: 可以对比使用/不使用增强负类的模型性能
4. **实际验证**: 快速验证脚本确保模型在实际场景中的表现符合预期

---

**实施日期**: 2026-02-04  
**模型版本**: app_model_002_aug  
**状态**: ✅ 实施完成


