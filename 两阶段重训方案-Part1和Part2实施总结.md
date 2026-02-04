# VulnRisk 两阶段重训方案 - Part 1 & Part 2 实施总结

**完成时间**: 2026-02-03

---

## Part 1: 后端 GitHub 抓取 Stage A 负类

### 实施内容

#### 1. 修改 `backend-node/src/services/github.service.ts`

**新增常量**:
- `BLACKLIST`: 排除安全相关关键词的查询条件
- `SECURITY_QUERIES`: 保留现有安全导向模板（重命名）
- `NEGATIVE_QUERIES_TEMPLATE`: 10个负类查询模板（bug/build/perf/ui/docs/tests/api/maintenance等）

**新增功能**:
- `ExportSearchCorpusOptions` 接口添加 `corpusType?: 'security' | 'negative'`
- 根据 `corpusType` 选择查询模板
- 自动 fallback 机制：
  - Fallback 1: 添加2022年查询
  - Fallback 2: 放宽comments要求（comments:>0 → comments:>=0）
- Summary 增加 `per_query_counts` 和 `fallback_used` 字段

#### 2. 修改 `backend-node/src/controllers/github.controller.ts`

- 从 `req.query.corpusType` 读取参数（默认 'security'）
- 验证参数有效性
- 透传给 service

#### 3. 修改 `backend-node/scripts/export-github-search-corpus.js`

- 添加 `--corpusType` 参数支持
- 当 `corpusType=negative` 时，默认 `targetCount=7000`
- 更新帮助文档

### 验收标准

✅ **negative 导出去重 deduped >= 5000**

---

## Part 2: Stage A 训练脚本支持三种模型

### 实施内容

#### 1. 重写 `ml-service/train_applicability_model.py`

**数据配置**:
- 正类：`merged_json_table.csv` 的 `description_clean`（去空、len>=20）
- 负类：`../data/github_issues_prs_clean.csv` 的 `text`（去空、len>=60）
- 采样：`MAX_POS=80000`（可配置50000/80000），`MAX_NEG=10000`（不足则全量）
- 固定 `SEED=42`，不做 SMOTE

**特征工程**:
- TF-IDF：`max_features=20000`, `ngram_range=(1,2)`, `stop_words='english'`, `min_df=2`, `max_df=0.95`

**模型支持**:
- `--model lr`: LogisticRegression（baseline）
  - `max_iter=4000`, `class_weight='balanced'`, `C=0.5`
- `--model xgb`: XGBoost（论文主模型）
  - `objective='binary:logistic'`, `n_estimators=600`, `max_depth=6`, `learning_rate=0.05`
  - `scale_pos_weight = neg_count/pos_count`（必须计算）
- `--model rf`: RandomForest（论文主模型）
  - `n_estimators=800`, `class_weight='balanced_subsample'`

**评估指标**:
- ROC-AUC、PR-AUC、classification_report
- 阈值扫描（0.3-0.8，步长0.05）找到最优 `app_threshold`

**输出目录**（按模型区分）:
- `models/app_model_001_lr/`
- `models/app_model_001_xgb/`
- `models/app_model_001_rf/`

**模型注册**:
- 自动调用 `register-model.js` 脚本注册到数据库
- 模型ID: `app_model_001_lr` / `app_model_001_xgb` / `app_model_001_rf`
- 类型: `applicability`
- 默认不激活（保持"只能激活一个模型"的逻辑）

#### 2. 修改 `backend-node/scripts/register-model.js`

- 支持 `metadata.model_type = 'applicability'`
- 兼容旧的 `model_type` 字段（LR/XGB/RF）

#### 3. 更新 `ml-service/README_RETRAIN.md`

- 添加 Part 1: 导出负类语料说明
- 添加 Part 2: 训练三种模型说明
- 说明论文对比策略（XGBoost/RF为主，LR为baseline）

---

## 可运行命令

### Part 1: 导出负类语料

```bash
cd backend-node
node scripts/export-github-search-corpus.js --targetCount 7000 --corpusType negative
```

### Part 2: 训练三种模型

```bash
cd ml-service

# 训练 XGBoost（推荐）
python train_applicability_model.py --model xgb

# 训练 RandomForest
python train_applicability_model.py --model rf

# 训练 LogisticRegression（baseline）
python train_applicability_model.py --model lr
```

---

## 文件修改清单

### 后端（backend-node/）

1. ✅ `src/services/github.service.ts`
   - 添加 BLACKLIST 和 NEGATIVE_QUERIES_TEMPLATE
   - 实现 fallback 机制
   - 更新 summary 包含 per_query_counts 和 fallback_used

2. ✅ `src/controllers/github.controller.ts`
   - 支持 `corpusType` 参数

3. ✅ `scripts/export-github-search-corpus.js`
   - 添加 `--corpusType` 参数
   - 默认 targetCount=7000（当 negative 时）

4. ✅ `scripts/register-model.js`
   - 支持 `applicability` 类型

### ML服务（ml-service/）

1. ✅ `train_applicability_model.py`
   - 完全重写，支持三种模型
   - 自动模型注册功能
   - 阈值扫描功能

2. ✅ `README_RETRAIN.md`
   - 添加 Part 1 和 Part 2 说明

---

## 验收标准

### Part 1
- ✅ negative 导出去重 `deduped >= 5000`
- ✅ summary 包含 `per_query_counts` 和 `fallback_used`

### Part 2
- ✅ 三种模型分别保存到不同目录
- ✅ 模型自动注册到数据库（不自动激活）
- ✅ metadata.json 包含所有必要信息（ROC-AUC、PR-AUC、app_threshold、scale_pos_weight等）
- ✅ 保持"多模型可注册、单模型激活"机制

---

**实施完成** ✅



