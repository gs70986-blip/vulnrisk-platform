# VulnRisk – Cursor Code Generation Spec (Node.js + Vue) v1.0

> 本文档用于 **直接喂给 Cursor 生成完整可运行代码**。
> 技术栈已固定：**后端 Node.js，前端 Vue 3**。

---

## 0. 使用说明（给 Cursor）
你是一个资深 **Node.js + 前端 + ML 工程师**。

**必须遵守：**
1. 严格按照本文档结构与约束生成代码
2. 优先保证：正确性 > 可运行性 > 可扩展性
3. 项目必须支持 `docker-compose up` 一键启动
4. ML 推理通过 **Python 子服务或 Python 脚本调用**（Node 不直接训练模型）

---

## 1. 项目目标
构建一个 **软件漏洞预测与风险评估平台**：

- 使用机器学习模型预测漏洞概率 `P(vuln)`
- 融合 `CVSS Base Score` 生成 `RiskScore`
- 输出风险等级：Low / Medium / High / Critical
- 提供 Web Dashboard + REST API

**系统定位：**
- 学术原型 + 工程可运行
- 支持论文复现与系统演示

---

## 2. 总体架构（强约束）

```
vulnrisk/
├── backend-node/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── datasets.ts
│   │   │   ├── models.ts
│   │   │   ├── predictions.ts
│   │   │   └── health.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── dataset.service.ts
│   │   │   ├── model.service.ts
│   │   │   ├── prediction.service.ts
│   │   │   └── risk.service.ts
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   └── models/
│   │   ├── utils/
│   │   └── config/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── ml-service/
│   ├── train.py
│   ├── predict.py
│   ├── risk.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend-vue/
│   ├── src/
│   │   ├── views/
│   │   │   ├── Datasets.vue
│   │   │   ├── Models.vue
│   │   │   ├── Predictions.vue
│   │   │   └── Report.vue
│   │   ├── components/
│   │   ├── services/api.ts
│   │   ├── router/
│   │   └── App.vue
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── config.yaml
└── README.md
```

---

## 3. 技术栈（不可替换）

### 后端（Node.js）
- Node.js 18+
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- Multer（文件上传）
- Axios（调用 ML 服务）

### ML 子服务（Python）
- Python 3.10+
- scikit-learn
- xgboost
- imbalanced-learn
- joblib

### 前端（Vue）
- Vue 3
- TypeScript
- Vite
- Element Plus
- ECharts

---

## 4. 数据集规范

### 4.1 输入字段（最小可运行集）
```json
{
  "sample_id": "string",
  "text_description": "string (required)",
  "cvss_base_score": "number (0-10, optional)",
  "label": "0 | 1 (training only)"
}
```

### 4.2 预处理策略（Python ML 服务中）
- 文本字段：
  - lowercase
  - 去除特殊字符
  - TF-IDF（max_features=20000）
- 数值字段：
  - 缺失允许
- 类别不平衡：
  - SMOTE（可配置）

---

## 5. 机器学习模块（Python 服务）

### 5.1 支持模型
- RandomForest
- XGBoost

### 5.2 训练输出
- model.joblib
- metadata.json
  - params
  - metrics
  - feature_importance

### 5.3 评估指标（必须返回）
- accuracy
- precision
- recall
- f1
- roc_auc

---

## 6. 风险评估模块（核心逻辑）

### 6.1 风险公式（必须实现）
```python
p = P_vuln  # [0,1]
if cvss exists:
    c = cvss / 10
    risk = alpha * p + beta * c
else:
    risk = p
```

- 默认：alpha = 0.6, beta = 0.4
- alpha + beta = 1（校验）

### 6.2 风险等级映射
| RiskScore | Level |
|---------|------|
| < 0.40 | Low |
| 0.40–0.69 | Medium |
| 0.70–0.89 | High |
| ≥ 0.90 | Critical |

---

## 7. 后端 API 规范（Node.js）

### 7.1 Dataset
- POST /api/datasets (CSV/JSON upload)
- GET /api/datasets
- POST /api/datasets/:id/preprocess

### 7.2 Model
- POST /api/models/train
- GET /api/models
- POST /api/models/:id/activate

### 7.3 Prediction
- POST /api/predict
- POST /api/predict/batch
- GET /api/predictions
- GET /api/predictions/:id

---

## 8. 前端功能需求（Vue）

### 8.1 数据集页面
- 上传 CSV/JSON
- 展示字段与记录数

### 8.2 模型页面
- 训练模型（参数表单）
- 模型指标展示（表格 + 图表）

### 8.3 风险列表页面
- 表格字段：
  - sample_id
  - P(vuln)
  - CVSS
  - RiskScore (0–100)
  - RiskLevel（颜色）

### 8.4 报告详情页
- 风险拆解
- 特征重要性 Top-K
- 原始文本描述

---

## 9. 数据库模型（Prisma）

### Dataset
- id
- name
- schema
- createdAt

### MLModel
- id
- type
- metrics
- artifactPath
- isActive

### Prediction
- id
- modelId
- sampleId
- pVuln
- cvss
- riskScore
- riskLevel
- createdAt

---

## 10. Docker Compose 要求

- postgres
- backend-node
- ml-service
- frontend-vue

所有服务必须通过 service name 互通。

---

## 11. 实现顺序（Cursor 强制遵守）

1. PostgreSQL + Prisma Schema
2. Node.js API（Dataset → Model → Prediction）
3. Python ML Service（train / predict）
4. 风险评估逻辑
5. Vue 前端页面
6. Docker Compose 集成

---

## 12. 验收标准

- `docker-compose up` 后：
  - 前端页面可访问
  - 后端 API 正常
  - ML 服务可训练和推理
- 完整流程：
  - 上传数据 → 训练 → 预测 → 风险报告

---

## 13. Cursor 启动指令（建议你直接用）

> Generate the full project strictly following `Cursor_Spec_Node_Vue_v1.md`.
> Do not simplify ML logic.
> Ensure all services are dockerized.

