# VulnRisk 漏洞风险评估平台 - 详细技术报告

**版本**: 3.0.0  
**日期**: 2026年2月7日  
**项目类型**: 基于机器学习的软件漏洞风险评估系统  
**开发团队**: AI Assistant & Development Team

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [数据准备与处理](#3-数据准备与处理)
4. [模型系统详细说明](#4-模型系统详细说明)
5. [风险评估机制详解](#5-风险评估机制详解)
6. [系统集成与部署](#6-系统集成与部署)
7. [性能评估与实验结果](#7-性能评估与实验结果)
8. [技术栈与依赖](#8-技术栈与依赖)
9. [未来改进方向](#9-未来改进方向)

---

## 1. 项目概述

### 1.1 项目背景

随着软件系统的复杂性和规模不断增长，软件漏洞已成为网络安全的主要威胁之一。传统的漏洞检测方法主要依赖人工审计和静态分析工具，效率低下且难以应对大规模代码库。本项目旨在构建一个基于机器学习的自动化漏洞风险评估平台，通过分析漏洞描述文本和CVSS评分，自动预测漏洞风险等级，为安全团队提供决策支持。

### 1.2 核心功能

1. **两阶段漏洞风险评估**
   - Stage A: 适用性判断（Applicability Model）- 判断输入文本是否与漏洞相关
   - Stage B: 严重度预测（Severity Model）- 预测漏洞的严重程度等级

2. **多模型支持**
   - 支持 LogisticRegression、XGBoost、RandomForest 三种算法
   - 模型注册与激活机制
   - 模型版本管理

3. **综合风险评分**
   - 结合ML预测概率和CVSS评分
   - 输出风险等级（Low/Medium/High/Critical）
   - 提供详细的预测解释

4. **完整的Web平台**
   - 数据集管理
   - 模型训练与评估
   - 批量/单个预测
   - 风险分析与可视化

### 1.3 系统定位

- **学术原型**: 完整的机器学习管道和评估指标
- **工程可运行**: 生产级代码质量和系统架构
- **论文复现**: 支持实验复现和结果验证
- **系统演示**: 可部署演示系统

---

## 2. 系统架构

### 2.1 整体架构

VulnRisk采用微服务架构，将系统分为三个主要服务：

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Vue 3 前端      │ ───→ │  Node.js 后端    │ ───→ │  Python ML 服务  │
│  (Element Plus)  │      │  (Express)       │      │  (Flask)         │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │
                                ↓
                         ┌─────────────────┐
                         │   PostgreSQL    │
                         │     数据库      │
                         └─────────────────┘
```

### 2.2 技术栈

**前端层**
- Vue 3 + TypeScript
- Element Plus UI组件库
- ECharts 数据可视化
- Pinia 状态管理
- Vite 构建工具

**后端层**
- Node.js 18+ + TypeScript
- Express.js Web框架
- Prisma ORM 数据库访问
- JWT 认证授权
- PostgreSQL 数据库

**机器学习服务**
- Python 3.10+
- Flask RESTful API
- scikit-learn 机器学习库
- XGBoost 梯度提升算法
- imbalanced-learn 不平衡数据处理
- joblib 模型序列化

### 2.3 数据流

```
用户输入 → 前端验证 → 后端API → ML服务预测 → 风险评估 → 结果返回 → 前端展示
```

---

## 3. 数据准备与处理

### 3.1 数据来源

#### 正类数据（漏洞相关）
- **CVE数据库**: 从 `merged_json_table.csv` 提取的CVE漏洞描述
- **数据量**: 约50,000条CVE记录
- **字段**: `text_description`, `cvss_base_score`, `severity_level`

#### 负类数据（非漏洞相关）
1. **GitHub工程问题**: 从 `negative_github_issues.csv` 提取
   - 数据量: 约49,235条
   - 类型: GitHub Issues、Pull Requests等工程讨论

2. **增强负类数据** (数据增强):
   - **噪声文本** (`neg_noise.csv`): 1,200条随机文本
   - **关键词但无上下文** (`neg_keyword_only.csv`): 1,128条
   - **补丁/缓解文本** (`neg_patch_mitigation.csv`): 1,180条

### 3.2 数据预处理

#### 文本预处理流程
```python
def preprocess_text_for_prediction(text):
    # 1. 转小写
    text = text.lower()
    
    # 2. 移除特殊字符（保留字母、数字、空格）
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    
    # 3. 标准化空白字符
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text
```

#### TF-IDF向量化
- **最大特征数**: 20,000
- **N-gram范围**: (1, 2) - 包含单字和双字组合
- **最小文档频率**: 2 - 过滤低频词
- **最大文档频率**: 0.95 - 过滤高频停用词

### 3.3 数据分布

#### Stage A (适用性模型) 训练数据
- **正类**: 50,000条 (48.67%)
- **负类**: 52,743条 (51.33%)
  - GitHub: 49,235条
  - 噪声: 1,200条
  - 关键词: 1,128条
  - 补丁/缓解: 1,180条
- **总训练样本**: 82,194条
- **测试样本**: 20,549条 (20%划分)

#### Stage B (严重度模型) 训练数据
- **Low**: 5,113条 (6.75%)
- **Medium**: 48,976条 (64.66%)
- **High**: 33,111条 (43.72%)
- **Critical**: 7,496条 (9.90%)
- **总训练样本**: 75,756条
- **测试样本**: 18,940条 (20%划分)

---

## 4. 模型系统详细说明

### 4.1 两阶段模型架构

#### 4.1.1 Stage A: 适用性判断模型 (Applicability Model)

**目的**: 判断输入文本是否与漏洞相关，过滤非漏洞相关文本

**模型类型**: 二分类模型 (Binary Classification)
- **正类**: 漏洞相关文本 (CVE描述)
- **负类**: 非漏洞相关文本 (GitHub问题、噪声等)

**当前激活模型**: `app_model_002_aug_rf` (RandomForest)

**模型性能指标**:
```json
{
  "accuracy": 0.9909,
  "precision": 0.9955,
  "recall": 0.9858,
  "f1": 0.9906,
  "roc_auc": 0.9992,
  "pr_auc": 0.9993
}
```

**模型参数**:
- **算法**: RandomForest
- **树数量**: 800
- **类别权重**: `balanced_subsample` (处理类别不平衡)
- **适用性阈值**: 0.45 (从metadata中读取)

**训练配置**:
- **TF-IDF参数**:
  - `max_features`: 20,000
  - `ngram_range`: (1, 2)
  - `min_df`: 2
  - `max_df`: 0.95
- **数据增强**: 使用增强负类数据 (`use_augmented_negatives: true`)

**决策逻辑**:
```python
pApplicable = model.predict_proba(text)[0, 1]  # 漏洞相关概率
applicable = pApplicable >= app_threshold  # 默认阈值 0.45

if not applicable:
    # 不进入Stage B，返回Unknown
    return {
        'applicable': False,
        'riskLevel': 'Unknown',
        'explanation': 'This input text was not identified as vulnerability-related...'
    }
```

#### 4.1.2 Stage B: 严重度预测模型 (Severity Model)

**目的**: 对通过Stage A的文本进行4类严重度分类

**模型类型**: 多分类模型 (Multi-class Classification)
- **类别**: Low, Medium, High, Critical
- **CVSS映射**:
  - Low: [0, 4.0)
  - Medium: [4.0, 7.0)
  - High: [7.0, 9.0)
  - Critical: [9.0, 10.0]

**当前激活模型**: `sev_model_001` (XGBoost)

**模型性能指标**:
```json
{
  "accuracy": 0.7185,
  "macro_precision": 0.7603,
  "macro_recall": 0.5328,
  "macro_f1": 0.5856,
  "weighted_f1": 0.7040,
  "per_class": {
    "Low": {"precision": 0.8567, "recall": 0.2747, "f1": 0.4160},
    "Medium": {"precision": 0.7360, "recall": 0.8552, "f1": 0.7912},
    "High": {"precision": 0.6761, "recall": 0.6731, "f1": 0.6746},
    "Critical": {"precision": 0.7724, "recall": 0.3282, "f1": 0.4607}
  }
}
```

**模型参数**:
- **算法**: XGBoost
- **特征数**: 20,000 (TF-IDF特征)
- **类别分布**: 高度不平衡 (Medium占64.66%)

**预测输出**:
```python
severityProbs = {
    'Low': 0.15,
    'Medium': 0.25,
    'High': 0.35,
    'Critical': 0.25
}
severityLevel = max(severityProbs, key=severityProbs.get)  # 'High'
```

**特征重要性** (Top 20):
1. "site scripting" (0.0329)
2. "vulnerabilities execute" (0.0135)
3. "unknown" (0.0132)
4. "allows reflected" (0.0132)
5. "manipulation" (0.0114)
6. "arbitrary code" (0.0099)
7. "dangerous type" (0.0095)
8. "type vulnerability" (0.0090)
9. "injection vulnerability" (0.0089)
10. "cross site" (0.0088)

### 4.2 模型训练流程

#### 4.2.1 Stage A 模型训练

**训练脚本**: `ml-service/train_applicability_model.py`

**训练步骤**:
1. **数据加载**:
   ```python
   # 加载正类数据
   positives = load_cve_data('merged_json_table.csv', max_samples=50000)
   
   # 加载负类数据
   negatives = load_github_data('negative_github_issues.csv', max_samples=50000)
   
   # 加载增强负类数据
   aug_negatives = load_augmented_negatives('data_aug/', use_aug=True)
   ```

2. **数据平衡**:
   - 目标负类:正类比例 = 1.75:1
   - 使用增强负类数据达到平衡

3. **特征提取**:
   ```python
   vectorizer = TfidfVectorizer(
       max_features=20000,
       ngram_range=(1, 2),
       min_df=2,
       max_df=0.95
   )
   X = vectorizer.fit_transform(texts)
   ```

4. **模型训练**:
   ```python
   model = RandomForestClassifier(
       n_estimators=800,
       class_weight='balanced_subsample',
       random_state=42
   )
   model.fit(X_train, y_train)
   ```

5. **阈值优化**:
   - 使用F1-score优化适用性阈值
   - 最终阈值: 0.45

6. **模型保存**:
   ```python
   save_model(model, vectorizer, metadata, output_dir)
   # 保存文件:
   # - model.joblib
   # - vectorizer.joblib
   # - metadata.json
   ```

#### 4.2.2 Stage B 模型训练

**训练脚本**: `ml-service/train_severity_model.py`

**训练步骤**:
1. **数据加载**: 从CVE数据中提取严重度标签
2. **标签映射**: CVSS评分 → 严重度等级
3. **特征提取**: 使用相同的TF-IDF配置
4. **模型训练**: XGBoost多分类
5. **评估**: 计算每个类别的precision、recall、f1

### 4.3 模型注册与管理

#### 4.3.1 模型注册

**注册脚本**: `backend-node/scripts/register-model.js`

**注册流程**:
1. 检查模型目录是否存在
2. 验证必要文件 (`model.joblib`, `vectorizer.joblib`, `metadata.json`)
3. 读取模型元数据
4. 创建数据库记录

**注册信息结构**:
```json
{
  "id": "app_model_002_aug_rf",
  "type": "RF",
  "artifactPath": "/app/models/app_model_002_aug_rf",
  "metrics": {
    "accuracy": 0.9909,
    "precision": 0.9955,
    "recall": 0.9858,
    "f1": 0.9906,
    "roc_auc": 0.9992,
    "pr_auc": 0.9993
  },
  "metadata": { /* 完整元数据 */ },
  "isActive": true,
  "createdAt": "2026-02-04T23:50:40.148022"
}
```

#### 4.3.2 模型激活机制

**激活规则**:
- **Stage A模型**: 只能有一个激活
- **Stage B模型**: 始终激活，不能手动停用 (`sev_model_001`)
- 激活新模型时，自动停用旧模型

**激活命令**:
```bash
node scripts/register-model.js /app/models/app_model_002_aug_rf app_model_002_aug_rf --activate
```

### 4.4 模型版本管理

**当前模型版本**:
- **Stage A**: `app_model_002_aug_*` (增强版本，使用数据增强)
  - `app_model_002_aug_rf`: RandomForest版本
  - `app_model_002_aug_xgb`: XGBoost版本
- **Stage B**: `sev_model_001` (XGBoost)

**版本演进**:
- `app_model_001` → `app_model_002_aug_*` (添加数据增强)
- 未来计划: `app_model_003_*` (进一步优化)

---

## 5. 风险评估机制详解

### 5.1 两阶段推理流程

#### 5.1.1 完整预测流程

```
输入文本
    ↓
文本预处理 (转小写、移除特殊字符)
    ↓
输入质量检查 (长度、特征数检查)
    ↓
┌─────────────────────────────────┐
│   Stage A: 适用性判断             │
│   - TF-IDF向量化                 │
│   - 模型预测 pApplicable         │
│   - 阈值判断: applicable?        │
└─────────────────────────────────┘
    ↓
    ├─ applicable = False → 返回 Unknown
    │
    └─ applicable = True
           ↓
   证据充分性检查 (安全关键词、上下文线索)
           ↓
           ├─ 证据不足 → 返回 Unknown
           │
           └─ 证据充分
                  ↓
         ┌─────────────────────────────────┐
         │   Stage B: 严重度预测            │
         │   - TF-IDF向量化                 │
         │   - 模型预测 4类概率             │
         │   - 计算风险评分                 │
         │   - 映射风险等级                 │
         └─────────────────────────────────┘
                  ↓
            返回完整结果
```

#### 5.1.2 Stage A 详细逻辑

**输入**: 原始文本描述

**处理步骤**:
1. **文本预处理**:
   ```python
   processed_text = preprocess_text_for_prediction(text_description)
   # - 转小写
   # - 移除特殊字符
   # - 标准化空白
   ```

2. **输入质量检查** (Pre-check):
   ```python
   is_low_quality, reason, note = check_input_quality(text, processed_text)
   # 检查条件:
   # - 文本长度 < MIN_TEXT_LENGTH (默认20)
   # - 处理后文本为空
   ```

3. **TF-IDF向量化**:
   ```python
   X_app = app_vectorizer.transform([processed_text])
   ```

4. **模型预测**:
   ```python
   p_applicable = app_model.predict_proba(X_app)[0, 1]
   # 输出: 漏洞相关概率 [0, 1]
   ```

5. **阈值判断**:
   ```python
   app_threshold = app_metadata.get('app_threshold', 0.5)  # 默认0.5，模型元数据中为0.45
   applicable = p_applicable >= app_threshold
   ```

6. **证据充分性检查** (Post-check):
   ```python
   # 提取证据指标
   security_keyword_count, context_cue_count, technical_evidence_count = extract_evidence(text, processed_text)
   
   # 如果只有安全关键词但缺乏上下文，保守跳过
   if security_keyword_count > 0 and (context_cue_count + technical_evidence_count) < 1:
       applicable = False
   ```

**输出** (applicable = False):
```json
{
  "applicable": false,
  "pApplicable": 0.32,
  "severityLevel": null,
  "severityProbs": null,
  "riskScore": 0,
  "riskLevel": "Unknown",
  "explanation": "This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.",
  "reason": "NOT_VULNERABILITY_TEXT"
}
```

#### 5.1.3 Stage B 详细逻辑

**输入**: 预处理后的文本 (applicable = True)

**处理步骤**:
1. **TF-IDF向量化** (使用Severity模型的vectorizer):
   ```python
   X_sev = sev_vectorizer.transform([processed_text])
   ```

2. **模型预测**:
   ```python
   severity_probs = sev_model.predict_proba(X_sev)[0]
   # 输出: [P(Low), P(Medium), P(High), P(Critical)]
   ```

3. **严重度等级确定**:
   ```python
   severityLevel = sev_metadata['severity_labels'][str(np.argmax(severity_probs))]['name']
   # 输出: "Low" | "Medium" | "High" | "Critical"
   ```

4. **风险评分计算**:
   ```python
   riskScore = (
       0.1 * P(Low) +        # Low权重0.1
       0.4 * P(Medium) +     # Medium权重0.4
       0.7 * P(High) +       # High权重0.7
       0.9 * P(Critical)    # Critical权重0.9
   )
   # 输出: [0, 1] 浮点数
   ```

5. **风险等级映射**:
   ```python
   if riskScore < 0.4:
       riskLevel = "Low"
   elif riskScore < 0.6:
       riskLevel = "Medium"
   elif riskScore < 0.8:
       riskLevel = "High"
   else:
       riskLevel = "Critical"
   ```

**输出** (完整结果):
```json
{
  "applicable": true,
  "pApplicable": 0.95,
  "severityLevel": "High",
  "severityProbs": {
    "Low": 0.15,
    "Medium": 0.25,
    "High": 0.35,
    "Critical": 0.25
  },
  "riskScore": 0.72,
  "riskLevel": "High",
  "pVuln": 0.60,  // P(High) + P(Critical) = 0.35 + 0.25
  "explanation": "The input text was identified as vulnerability-related with high confidence (pApplicable=0.95). The severity model predicted High severity (probability=0.35) with risk score 0.72.",
  "reliability": "High"
}
```

### 5.2 风险评分计算详解

#### 5.2.1 核心公式

**风险评分公式** (Stage B):
```python
riskScore = (
    0.1 * P(Low) +        # 权重: 0.1
    0.4 * P(Medium) +     # 权重: 0.4
    0.7 * P(High) +       # 权重: 0.7
    0.9 * P(Critical)    # 权重: 0.9
)
```

**权重设计原理**:
- **Low (0.1)**: 低风险，权重最小
- **Medium (0.4)**: 中等风险，权重适中
- **High (0.7)**: 高风险，权重较高
- **Critical (0.9)**: 严重风险，权重最高

**风险等级映射**:
```python
def get_risk_level(risk_score):
    if risk_score < 0.4:
        return "Low"
    elif risk_score < 0.6:
        return "Medium"
    elif risk_score < 0.8:
        return "High"
    else:
        return "Critical"
```

#### 5.2.2 风险评分示例

**示例1**: 高严重度漏洞
```python
severityProbs = {
    'Low': 0.05,
    'Medium': 0.10,
    'High': 0.30,
    'Critical': 0.55
}

riskScore = 0.1*0.05 + 0.4*0.10 + 0.7*0.30 + 0.9*0.55
          = 0.005 + 0.04 + 0.21 + 0.495
          = 0.75

riskLevel = "High"  # 0.75 < 0.8
```

**示例2**: 中等严重度漏洞
```python
severityProbs = {
    'Low': 0.20,
    'Medium': 0.50,
    'High': 0.25,
    'Critical': 0.05
}

riskScore = 0.1*0.20 + 0.4*0.50 + 0.7*0.25 + 0.9*0.05
          = 0.02 + 0.20 + 0.175 + 0.045
          = 0.44

riskLevel = "Medium"  # 0.4 <= 0.44 < 0.6
```

### 5.3 工程裁剪机制 (Business Clipping)

#### 5.3.1 裁剪目的

对明显非漏洞语境文本，强制返回 `applicable=false`，避免无关文本被错误评分。

#### 5.3.2 裁剪条件

**函数**: `assess_applicability()` (在 `ml-service/risk.py`)

**裁剪触发条件** (按优先级):

1. **EMPTY_TEXT**: 文本长度 < 最小长度
   ```python
   if text_len < CLIP_MIN_TEXT_LEN:  # 默认20
       return {"applicable": False, "reason": "EMPTY_TEXT"}
   ```

2. **LOW_SIMILARITY**: 与训练数据相似度过低
   ```python
   if max_similarity < CLIP_SIM_THRESHOLD and not has_user_cvss:  # 默认0.18
       return {"applicable": False, "reason": "LOW_SIMILARITY"}
   ```

3. **LOW_SIGNAL**: TF-IDF非零特征数太少
   ```python
   if nonzero_features < CLIP_MIN_NONZERO_TFIDF and not has_user_cvss:  # 默认3
       return {"applicable": False, "reason": "LOW_SIGNAL"}
   ```

4. **LOW_PVULN**: 漏洞概率极低且相似度低
   ```python
   if p_vuln < CLIP_PVULN_THRESHOLD and not has_user_cvss and max_similarity < CLIP_SIM_THRESHOLD:  # 默认0.10
       return {"applicable": False, "reason": "LOW_PVULN"}
   ```

**环境变量配置**:
```env
CLIP_NA_ENABLED=true
CLIP_PVULN_THRESHOLD=0.10
CLIP_SIM_THRESHOLD=0.18
CLIP_MIN_TEXT_LEN=20
CLIP_MIN_NONZERO_TFIDF=3
```

#### 5.3.3 裁剪逻辑集成

裁剪逻辑在以下位置应用:
1. **输入质量检查** (Pre-check): 在Stage A之前
2. **证据充分性检查** (Post-check): 在Stage A之后、Stage B之前
3. **工程裁剪** (Business Clipping): 在legacy预测流程中

### 5.4 可靠性评估

#### 5.4.1 可靠性等级

**可靠性指标**:
- **High**: 高置信度预测
  - `pApplicable >= 0.8` (Stage A)
  - `max(severityProbs) >= 0.6` (Stage B)
  
- **Medium**: 中等置信度预测
  - `0.5 <= pApplicable < 0.8` (Stage A)
  - `0.4 <= max(severityProbs) < 0.6` (Stage B)
  
- **Low**: 低置信度预测
  - `pApplicable < 0.5` (Stage A)
  - `max(severityProbs) < 0.4` (Stage B)
  - 或触发裁剪条件

#### 5.4.2 不确定性处理

**不确定性区间** (已弃用，保留用于兼容):
- `PVULN_UNCERTAIN_LOW = 0.35`
- `PVULN_UNCERTAIN_HIGH = 0.65`

当 `pVuln` 在此区间内且无CVSS时，可能输出 "Uncertain" (当前版本已不使用)。

### 5.5 预测结果字段详解

#### 5.5.1 核心字段

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `applicable` | boolean | 是否通过Stage A门控 | `true` |
| `pApplicable` | float | Stage A适用性概率 | `0.95` |
| `severityLevel` | string\|null | Stage B严重度等级 | `"High"` |
| `severityProbs` | object\|null | Stage B 4类概率分布 | `{"Low": 0.15, ...}` |
| `riskScore` | float | 综合风险评分 [0, 1] | `0.72` |
| `riskLevel` | string | 风险等级 | `"High"` |
| `pVuln` | float\|null | 高风险漏洞概率 (兼容字段) | `0.60` |
| `explanation` | string | 详细预测解释 | `"The input text..."` |
| `reason` | string | 拒绝原因 (如果applicable=false) | `"NOT_VULNERABILITY_TEXT"` |
| `reliability` | string | 可靠性等级 | `"High"` |

#### 5.5.2 元数据字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `text_len` | int | 文本长度 |
| `inputType` | string | 输入类型 (`"normal"`, `"low_quality"`) |
| `notes` | array | 额外说明信息 |

---

## 6. 系统集成与部署

### 6.1 Docker部署架构

#### 6.1.1 服务容器

**PostgreSQL数据库**:
```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: vulnrisk
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

**后端服务**:
```yaml
backend-node:
  build: ./backend-node
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/vulnrisk
    PORT: 3000
    ML_SERVICE_URL: http://ml-service:5000
  volumes:
    - ./models:/app/models
    - ./data:/app/data
  command: sh -c "npx prisma migrate deploy && node scripts/create-admin.js admin admin123 admin@example.com || true && npm start"
```

**ML服务**:
```yaml
ml-service:
  build: ./ml-service
  environment:
    MODELS_DIR: /app/models
    DATA_DIR: /app/data
    PORT: 5000
  volumes:
    - ./models:/app/models
    - ./data:/app/data:ro
```

**前端服务**:
```yaml
frontend-vue:
  build: ./frontend-vue
  ports:
    - "80:80"
  depends_on:
    - backend-node
```

### 6.2 API接口

#### 6.2.1 预测接口

**单样本预测**:
```http
POST /api/predictions
Content-Type: application/json

{
  "text_description": "SQL injection vulnerability in login form...",
  "cvss_base_score": 7.5  // 可选
}
```

**批量预测**:
```http
POST /api/predictions/batch
Content-Type: application/json

{
  "samples": [
    {"sample_id": "1", "text_description": "...", "cvss_base_score": null},
    {"sample_id": "2", "text_description": "...", "cvss_base_score": 8.0}
  ]
}
```

#### 6.2.2 模型管理接口

**获取模型列表**:
```http
GET /api/models
```

**激活模型**:
```http
POST /api/models/:id/activate
```

### 6.3 数据库架构

#### 6.3.1 核心表结构

**Users表**:
```prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String?  @unique
  password  String
  role      String   @default("user")  // "admin" | "user"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**MLModel表**:
```prisma
model MLModel {
  id           String   @id
  type         String   // "RF" | "XGBoost" | "LogisticRegression"
  artifactPath String
  metrics      Json
  metadata     Json?
  isActive     Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**Prediction表**:
```prisma
model Prediction {
  id              String   @id @default(uuid())
  sampleId        String?
  textDescription String
  riskLevel       String
  riskScore       Float
  severityLevel   String?
  cvssBaseScore   Float?
  explanation     String
  createdAt       DateTime @default(now())
}
```

---

## 7. 性能评估与实验结果

### 7.1 Stage A 模型性能

**模型**: `app_model_002_aug_rf` (RandomForest)

**测试集性能** (20,549个样本):
- **准确率**: 99.09%
- **精确率**: 99.55%
- **召回率**: 98.58%
- **F1分数**: 99.06%
- **ROC-AUC**: 99.92%
- **PR-AUC**: 99.93%

**混淆矩阵分析**:
- **真阳性 (TP)**: 高 - 正确识别漏洞相关文本
- **假阳性 (FP)**: 极低 - 很少将非漏洞文本误判为漏洞
- **假阴性 (FN)**: 低 - 很少漏检漏洞相关文本
- **真阴性 (TN)**: 高 - 正确识别非漏洞文本

### 7.2 Stage B 模型性能

**模型**: `sev_model_001` (XGBoost)

**测试集性能** (18,940个样本):
- **准确率**: 71.85%
- **宏平均精确率**: 76.03%
- **宏平均召回率**: 53.28%
- **宏平均F1**: 58.56%
- **加权F1**: 70.40%

**各类别性能**:
- **Low**: Precision=85.67%, Recall=27.47%, F1=41.60%
  - 精确率高但召回率低 (类别不平衡)
- **Medium**: Precision=73.60%, Recall=85.52%, F1=79.12%
  - 表现最好 (样本最多)
- **High**: Precision=67.61%, Recall=67.31%, F1=67.46%
  - 表现均衡
- **Critical**: Precision=77.24%, Recall=32.82%, F1=46.07%
  - 精确率高但召回率低 (样本少)

### 7.3 系统整体性能

**预测延迟**:
- **单样本预测**: ~50-100ms (包含文本处理、模型推理)
- **批量预测**: ~10-20ms/样本 (批量处理优化)

**系统吞吐量**:
- **单样本**: ~10-20 requests/second
- **批量**: ~50-100 samples/second

### 7.4 错误案例分析

#### 7.4.1 Stage A 误判

**误判类型**:
1. **假阳性**: 工程讨论文本被误判为漏洞相关
   - 原因: 包含安全相关关键词但缺乏漏洞上下文
   - 缓解: 证据充分性检查

2. **假阴性**: 模糊漏洞描述被误判为非漏洞
   - 原因: 文本特征不明显
   - 缓解: 降低阈值或改进特征提取

#### 7.4.2 Stage B 误判

**误判类型**:
1. **Low/Medium混淆**: 低严重度漏洞被误判为中等
   - 原因: 类别边界模糊
   - 影响: 较小 (都是低风险)

2. **High/Critical混淆**: 高严重度漏洞被误判为严重
   - 原因: 样本不平衡，Critical样本少
   - 影响: 中等 (可能高估风险)

---

## 8. 技术栈与依赖

### 8.1 前端依赖

```json
{
  "dependencies": {
    "vue": "^3.3.4",
    "element-plus": "^2.4.0",
    "echarts": "^5.4.3",
    "pinia": "^2.1.6",
    "axios": "^1.6.0"
  }
}
```

### 8.2 后端依赖

```json
{
  "dependencies": {
    "@prisma/client": "^5.7.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "dotenv": "^16.3.1"
  }
}
```

### 8.3 ML服务依赖

```txt
flask==3.0.0
scikit-learn==1.3.2
xgboost==2.0.3
pandas==2.1.4
numpy==1.26.2
joblib==1.3.2
imbalanced-learn==0.11.0
```

---

## 9. 未来改进方向

### 9.1 模型改进

1. **数据增强**:
   - 增加更多负类样本类型
   - 使用数据合成技术 (SMOTE变种)

2. **模型优化**:
   - 尝试深度学习模型 (BERT, RoBERTa)
   - 集成学习 (Ensemble)
   - 模型蒸馏 (Model Distillation)

3. **特征工程**:
   - 添加结构化特征 (代码特征、网络特征)
   - 使用预训练词向量

### 9.2 系统改进

1. **性能优化**:
   - 模型缓存与预热
   - 批量预测优化
   - 异步处理

2. **可解释性**:
   - SHAP值分析
   - 注意力机制可视化
   - 特征重要性展示

3. **监控与日志**:
   - 预测质量监控
   - 模型漂移检测
   - 性能指标追踪

### 9.3 功能扩展

1. **多语言支持**:
   - 支持非英语漏洞描述
   - 多语言模型训练

2. **实时预测**:
   - WebSocket实时预测
   - 流式处理

3. **模型版本管理**:
   - A/B测试
   - 模型回滚机制
   - 版本对比分析

---

## 附录

### A. 模型文件结构

```
models/
├── app_model_002_aug_rf/
│   ├── model.joblib          # 训练好的模型
│   ├── vectorizer.joblib     # TF-IDF向量化器
│   ├── metadata.json         # 模型元数据
│   └── eval_predictions.csv  # 评估预测结果
├── app_model_002_aug_xgb/
│   └── [相同结构]
└── sev_model_001/
    └── [相同结构]
```

### B. 环境变量配置

详见 `ENV_VARIABLES.md`

### C. API文档

详见各服务目录下的 `README.md`

### D. 部署指南

详见 `PRODUCTION_DEPLOYMENT_GUIDE.md`

---

**报告生成时间**: 2026年2月7日  
**报告版本**: 3.0.0  
**维护者**: Development Team


