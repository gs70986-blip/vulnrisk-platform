# VulnRisk 两阶段重训方案

本文档说明如何运行两阶段重训流程。

---

## Part 1: 导出负类语料（Stage A 训练数据）

### 导出 negative 语料

```bash
cd backend-node
node scripts/export-github-search-corpus.js --targetCount 7000 --corpusType negative
```

**说明**:
- `--corpusType negative`: 使用负类查询模板（排除安全相关关键词）
- `--targetCount 7000`: 目标去重数量（默认7000，验收标准≥5000）
- 输出文件: `data/github_corpus_issues_prs.jsonl`（会覆盖security语料）

**验收标准**: 去重后 `deduped >= 5000`

---

## 环境要求

- Python 3.8+
- 依赖包（见 `requirements.txt`）:
  - scikit-learn
  - xgboost
  - imbalanced-learn
  - pandas
  - numpy
  - joblib

---

## 数据文件

### 必需文件

1. **GitHub语料**: `../data/github_corpus_issues_prs.jsonl`
   - 格式: JSONL，每行一个JSON对象
   - 字段: `id`, `type`, `title`, `body`, `comments`, `url`, `owner`, `repo`, `number`, ...

2. **CVE数据**: `ml-service/merged_json_table.csv`
   - 格式: CSV
   - 必需字段: `description_clean`, `cvss_base`, `cvss_severity`

---

## 运行步骤

### 方式1: 一键重训（推荐）

```bash
cd ml-service
python run_retrain_pipeline.py
```

可选参数:
```bash
python run_retrain_pipeline.py --n-samples 50000  # 指定采样数量
python run_retrain_pipeline.py --skip-github      # 跳过GitHub数据构建
python run_retrain_pipeline.py --skip-app         # 跳过Applicability模型训练
python run_retrain_pipeline.py --skip-sev         # 跳过Severity模型训练
```

### 方式2: 分步执行

#### 步骤1: 构建GitHub训练负类数据

```bash
cd ml-service
python build_github_dataset.py
```

**输出文件**:
- `../data/github_issues_prs_clean.csv`: 清洗后的GitHub数据
- `../data/github_issues_prs_clean_summary.json`: 统计摘要

**配置参数**（在脚本中修改）:
- `MIN_TEXT_LENGTH = 60`: 最小文本长度
- `SYMBOL_RATIO_THRESHOLD = 0.35`: 符号/代码字符比例阈值

**验收标准**: `clean.csv` 行数 >= 2000

如果未达标，可以调整阈值:
- 降低 `MIN_TEXT_LENGTH`（例如改为 40）
- 提高 `SYMBOL_RATIO_THRESHOLD`（例如改为 0.45）

---

#### 步骤2: 训练Applicability模型

```bash
cd ml-service
python train_applicability_model.py
```

可选参数:
```bash
python train_applicability_model.py --n-samples 50000  # 指定采样数量
python train_applicability_model.py --output-dir ../models/app_model_001  # 指定输出目录
```

**输出目录**: `../models/app_model_001/`

**输出文件**:
- `model.joblib`: 训练好的模型
- `vectorizer.joblib`: TF-IDF向量化器
- `metadata.json`: 模型元数据和指标（包含ROC-AUC、PR-AUC、app_threshold、scale_pos_weight等）
- `eval_predictions.csv`: 测试集预测结果

**模型参数**:
- **LogisticRegression**: max_iter=4000, class_weight='balanced', C=0.5
- **XGBoost**: n_estimators=600, max_depth=6, learning_rate=0.05, scale_pos_weight=neg_count/pos_count
- **RandomForest**: n_estimators=800, class_weight='balanced_subsample'

**验收标准**: ROC-AUC >= 0.85

**模型注册**:
训练完成后，模型会自动注册到数据库（通过调用 `register-model.js` 脚本）:
- 模型ID: `app_model_001_lr` / `app_model_001_xgb` / `app_model_001_rf`
- 类型: `applicability`
- 默认不激活，需要手动激活（保持"只能激活一个模型"的逻辑）

如果未达标，建议:
1. 检查GitHub文本质量
2. 检查是否混入了安全相关的issue作为负类
3. 增加负类中"明显非安全"样本的比例

---

#### 步骤3: 训练Severity模型（4类）

```bash
cd ml-service
python train_severity_model.py train_severity_config.json
```

**配置文件**: `train_severity_config.json`

**输出目录**: `../models/sev_model_001/`

**输出文件**:
- `model.joblib`: 训练好的模型
- `vectorizer.joblib`: TF-IDF向量化器
- `metadata.json`: 模型元数据和指标
- `training_predictions.csv`: 训练集预测结果

**标签定义**:
- 0 Low: [0, 4.0)
- 1 Medium: [4.0, 7.0)
- 2 High: [7.0, 9.0)
- 3 Critical: [9.0, 10.0]

**验收标准**: `metadata.json` 中包含 `macro_f1` 与每类指标；模型能输出4类概率

---

## 输出目录结构

```
models/
├── app_model_001/          # Applicability模型
│   ├── model.joblib
│   ├── vectorizer.joblib
│   ├── metadata.json
│   └── training_predictions.csv
├── sev_model_001/          # Severity模型（4类）
│   ├── model.joblib
│   ├── vectorizer.joblib
│   ├── metadata.json
│   └── training_predictions.csv
└── retrain_report.md        # 重训报告
```

---

## 指标解释

### Applicability模型指标

- **ROC-AUC**: 适用性分类的ROC曲线下面积（目标 >= 0.85）
- **Accuracy**: 准确率
- **Precision**: 精确率（正类预测准确率）
- **Recall**: 召回率（正类覆盖率）
- **F1**: F1分数（精确率和召回率的调和平均）
- **app_threshold**: 建议的适用性阈值（默认 0.5）

### Severity模型指标

- **Macro F1**: 宏平均F1分数（4类平均）
- **Accuracy**: 准确率
- **Macro Precision**: 宏平均精确率
- **Macro Recall**: 宏平均召回率
- **Per-class metrics**: 每类的精确率、召回率、F1

---

## 使用新模型

### ML服务配置

ML服务会自动检测两阶段模型是否存在。如果 `models/app_model_001/` 和 `models/sev_model_001/` 都存在，将自动使用两阶段推理。

### API调用

预测API会自动使用两阶段模型（如果存在），无需修改请求格式。

**响应字段**:
- `pApplicable`: 适用性概率
- `applicable`: 是否适用（布尔值）
- `severityLevel`: 严重度等级（Low/Medium/High/Critical/N/A）
- `severityProbs`: 4类概率分布
- `riskScore`: 风险评分（期望加权）
- `pVuln`: 兼容字段（P(High) + P(Critical)）
- `riskLevel`: 兼容字段（映射到severityLevel）

---

## 故障排除

### 问题1: GitHub数据清洗后行数不足2000

**解决方案**:
1. 检查输入文件 `github_corpus_issues_prs.jsonl` 是否足够大
2. 降低 `MIN_TEXT_LENGTH` 阈值
3. 提高 `SYMBOL_RATIO_THRESHOLD` 阈值

### 问题2: Applicability模型ROC-AUC < 0.85

**解决方案**:
1. 检查GitHub数据质量（是否包含过多安全相关issue）
2. 增加负类中"明显非安全"样本的比例
3. 调整采样数量 `--n-samples`

### 问题3: Severity模型训练失败

**解决方案**:
1. 检查CVE数据是否包含有效的 `cvss_base` 或 `cvss_severity`
2. 检查数据量是否足够
3. 检查配置文件路径是否正确

---

## 论文复现

重训报告保存在 `models/retrain_report.md`，包含:
- 数据规模统计
- 各模型性能指标
- 标签定义
- XSS样例输入输出对比
- 新旧系统差异说明

可用于论文写作和答辩复现。

---

**最后更新**: 2026-02-03

