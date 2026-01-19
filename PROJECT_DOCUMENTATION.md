# VulnRisk: 基于机器学习的软件漏洞风险评估平台

## 项目文档

**版本**: 1.0.0  
**日期**: 2024年12月  
**作者**: VulnRisk Development Team

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [技术栈](#3-技术栈)
4. [核心功能模块](#4-核心功能模块)
5. [算法实现](#5-算法实现)
6. [数据库设计](#6-数据库设计)
7. [API设计](#7-api设计)
8. [前端设计](#8-前端设计)
9. [安全与认证](#9-安全与认证)
10. [部署方案](#10-部署方案)
11. [实验与评估](#11-实验与评估)
12. [未来工作](#12-未来工作)

---

## 1. 项目概述

### 1.1 项目背景

随着软件系统的复杂性和规模不断增长，软件漏洞已成为网络安全的主要威胁之一。传统的漏洞检测方法主要依赖人工审计和静态分析工具，效率低下且难以应对大规模代码库。本项目旨在构建一个基于机器学习的自动化漏洞风险评估平台，通过分析漏洞描述文本和CVSS评分，自动预测漏洞风险等级，为安全团队提供决策支持。

### 1.2 项目目标

1. **自动化风险评估**: 基于机器学习模型自动预测漏洞概率
2. **综合风险评分**: 结合ML预测结果和CVSS评分计算综合风险分数
3. **用户友好界面**: 提供直观的Web界面进行模型管理和预测操作
4. **可扩展架构**: 支持多种机器学习算法和模型版本管理
5. **生产就绪**: 完整的认证授权、数据持久化和API设计

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
│   Vue 3 前端     │─────→│  Node.js 后端    │─────→│  Python ML 服务  │
│   (Element Plus) │      │   (Express)     │      │   (Flask)       │
│   Port: 80       │      │   Port: 3000    │      │   Port: 5000    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                  │
                                  ↓
                          ┌─────────────────┐
                          │   PostgreSQL    │
                          │   Port: 5432    │
                          └─────────────────┘
```

### 2.2 服务职责

#### 2.2.1 前端服务 (Frontend)
- **技术**: Vue 3 + TypeScript + Element Plus + ECharts
- **职责**:
  - 用户界面渲染
  - 用户交互处理
  - 数据可视化
  - 路由管理和状态管理

#### 2.2.2 后端服务 (Backend)
- **技术**: Node.js + TypeScript + Express + Prisma
- **职责**:
  - RESTful API提供
  - 业务逻辑处理
  - 数据库访问
  - 用户认证授权
  - 文件上传处理

#### 2.2.3 机器学习服务 (ML Service)
- **技术**: Python + Flask + scikit-learn + XGBoost
- **职责**:
  - 模型训练
  - 预测推理
  - 风险评分计算
  - 特征工程

#### 2.2.4 数据库服务 (Database)
- **技术**: PostgreSQL 15
- **职责**:
  - 数据持久化
  - 事务管理
  - 数据完整性保证

### 2.3 数据流

```
用户输入 → 前端 → 后端API → ML服务 → 模型推理 → 风险计算 → 结果返回 → 前端展示
```

---

## 3. 技术栈

### 3.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.3.11 | 前端框架 |
| TypeScript | 5.3.3 | 类型安全 |
| Element Plus | 2.5.0 | UI组件库 |
| Vue Router | 4.2.5 | 路由管理 |
| Pinia | - | 状态管理 |
| Axios | 1.6.2 | HTTP客户端 |
| ECharts | 5.4.3 | 数据可视化 |
| Vite | 5.0.8 | 构建工具 |

### 3.2 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 运行时环境 |
| TypeScript | 5.3.3 | 类型安全 |
| Express | 4.18.2 | Web框架 |
| Prisma | 5.7.1 | ORM框架 |
| PostgreSQL | 15 | 关系数据库 |
| JWT | 9.0.3 | 身份认证 |
| bcrypt | 6.0.0 | 密码加密 |
| Multer | 1.4.5 | 文件上传 |
| xlsx | 0.18.5 | Excel处理 |

### 3.3 机器学习技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11 | 编程语言 |
| Flask | 2.3.0+ | Web框架 |
| scikit-learn | 1.8.0+ | 机器学习库 |
| XGBoost | 2.0.0+ | 梯度提升算法 |
| imbalanced-learn | 0.11.0+ | 不平衡数据处理 |
| pandas | 2.0.0+ | 数据处理 |
| numpy | 1.24.0+ | 数值计算 |
| joblib | 1.3.0+ | 模型序列化 |

### 3.4 部署技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Docker | Latest | 容器化 |
| Docker Compose | Latest | 服务编排 |
| Nginx | Latest | 反向代理 |

---

## 4. 核心功能模块

### 4.1 用户认证与授权

#### 4.1.1 功能描述
- 用户注册和登录
- 基于JWT的身份认证
- 基于角色的访问控制(RBAC)
- 密码加密存储

#### 4.1.2 角色定义
- **管理员(Admin)**: 可访问所有功能，包括数据集管理
- **普通用户(User)**: 可访问模型查看和预测功能

#### 4.1.3 实现细节
- 使用bcrypt进行密码哈希(10轮)
- JWT token有效期: 7天
- Token存储在localStorage
- 路由守卫保护需要认证的页面

### 4.2 数据集管理

#### 4.2.1 功能描述
- 支持CSV和JSON格式数据集上传
- 自动分析数据集结构
- 数据集元数据存储
- 数据集列表查看

#### 4.2.2 数据格式要求
- **必需字段**: `sample_id` (或 `id`), `text_description` (或 `description`)
- **可选字段**: `cvss_base_score` (或 `cvss`)
- **支持格式**: CSV, JSON

### 4.3 模型管理

#### 4.3.1 功能描述
- 模型训练(管理员功能，已移除手动训练)
- 预训练模型注册
- 模型激活/停用
- 模型指标查看
- 模型详情展示

#### 4.3.2 支持的算法
- **Random Forest**: 随机森林分类器
- **XGBoost**: 梯度提升决策树

#### 4.3.3 模型指标
- Accuracy (准确率)
- Precision (精确率)
- Recall (召回率)
- F1 Score (F1分数)
- ROC-AUC (ROC曲线下面积)

### 4.4 预测功能

#### 4.4.1 单样本预测
- 输入样本ID和文本描述
- 可选输入CVSS基础评分
- 实时返回预测结果

#### 4.4.2 批量预测
- 支持JSON、CSV、Excel文件上传
- 自动解析文件格式
- 批量处理并保存结果
- 支持大文件处理(最大100MB)

#### 4.4.3 预测结果
- P(vuln): 漏洞概率 [0, 1]
- Risk Score: 综合风险评分 [0, 1]
- Risk Level: 风险等级 (Low/Medium/High/Critical)
- CVSS: CVSS基础评分 [0, 10]

### 4.5 结果导出

#### 4.5.1 支持格式
- **CSV**: 逗号分隔值格式
- **Excel**: .xlsx格式
- **JSON**: JSON格式

#### 4.5.2 导出字段
- ID, Sample ID, Text Description
- P(vuln), CVSS, Risk Score, Risk Level
- Model Type, Created At

### 4.6 风险报告

#### 4.6.1 功能描述
- 详细的预测结果展示
- 风险组件可视化
- 特征重要性分析
- 原始文本描述展示

#### 4.6.2 可视化组件
- 风险组件柱状图
- Top 15特征重要性图
- 进度条展示风险评分

---

## 5. 算法实现

### 5.1 特征工程

#### 5.1.1 文本预处理
```python
1. 文本转小写
2. 移除特殊字符
3. 分词处理
4. 停用词移除
```

#### 5.1.2 TF-IDF向量化
- **最大特征数**: 20,000
- **N-gram范围**: (1, 2)
- **最小文档频率**: 2
- **最大文档频率**: 0.95
- **停用词**: 英文停用词列表

### 5.2 模型训练

#### 5.2.1 数据分割
- **训练集**: 80%
- **测试集**: 20%
- **随机种子**: 42

#### 5.2.2 不平衡数据处理
- **SMOTE**: Synthetic Minority Oversampling Technique
- 仅在训练集上应用
- 平衡类别分布

#### 5.2.3 模型校准
- **方法**: CalibratedClassifierCV
- **校准方法**: Platt Scaling
- **目的**: 获得准确的概率估计

#### 5.2.4 模型参数

**Random Forest**:
- n_estimators: 100
- max_depth: 20
- min_samples_split: 5
- min_samples_leaf: 2
- random_state: 42

**XGBoost**:
- n_estimators: 100
- max_depth: 6
- learning_rate: 0.1
- subsample: 0.8
- colsample_bytree: 0.8
- random_state: 42

### 5.3 风险评分算法

#### 5.3.1 风险评分公式

```
RiskScore = α × P(vuln) + (1 - α) × CVSS_norm
```

其中:
- `P(vuln)`: 模型预测的漏洞概率 [0, 1]
- `CVSS_norm`: 归一化的CVSS评分 = CVSS_base / 10.0 [0, 1]
- `α`: 权重参数，默认值为0.6

#### 5.3.2 风险等级映射

| Risk Score | Risk Level |
|------------|------------|
| [0, 0.4)   | Low        |
| [0.4, 0.6) | Medium     |
| [0.6, 0.8) | High       |
| [0.8, 1.0] | Critical   |

#### 5.3.3 特殊情况处理
- 如果CVSS评分为空，则 `RiskScore = P(vuln)`
- 所有值被限制在[0, 1]范围内

### 5.4 评估指标

#### 5.4.1 分类指标
- **Accuracy**: 准确率 = (TP + TN) / (TP + TN + FP + FN)
- **Precision**: 精确率 = TP / (TP + FP)
- **Recall**: 召回率 = TP / (TP + FN)
- **F1 Score**: F1分数 = 2 × (Precision × Recall) / (Precision + Recall)

#### 5.4.2 概率指标
- **ROC-AUC**: ROC曲线下面积，衡量模型区分能力

---

## 6. 数据库设计

### 6.1 数据库架构

使用PostgreSQL作为关系数据库，通过Prisma ORM进行数据访问。

### 6.2 数据模型

#### 6.2.1 User (用户表)

```prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String?  @unique
  password  String   // Hashed password
  role      String   @default("user") // "admin" | "user"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
  @@index([username])
  @@index([email])
}
```

**字段说明**:
- `id`: 主键，UUID格式
- `username`: 用户名，唯一
- `email`: 邮箱，可选，唯一
- `password`: 密码哈希值
- `role`: 用户角色，默认"user"

#### 6.2.2 Dataset (数据集表)

```prisma
model Dataset {
  id        String   @id @default(uuid())
  name      String
  schema    Json     // Stores field schema information
  recordCount Int    @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("datasets")
}
```

**字段说明**:
- `id`: 主键，UUID格式
- `name`: 数据集名称
- `schema`: JSON格式的字段结构信息
- `recordCount`: 记录数量

#### 6.2.3 MLModel (模型表)

```prisma
model MLModel {
  id           String   @id @default(uuid())
  type         String   // "RandomForest" | "XGBoost"
  metrics      Json     // Stores accuracy, precision, recall, f1, roc_auc
  artifactPath String   // Path to model.joblib file
  metadata     Json?    // Additional metadata (params, feature_importance)
  isActive     Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  predictions  Prediction[]

  @@map("ml_models")
}
```

**字段说明**:
- `id`: 主键，UUID格式
- `type`: 模型类型
- `metrics`: JSON格式的评估指标
- `artifactPath`: 模型文件路径
- `metadata`: 模型元数据(参数、特征重要性等)
- `isActive`: 是否激活

#### 6.2.4 Prediction (预测表)

```prisma
model Prediction {
  id        String   @id @default(uuid())
  modelId   String
  model     MLModel  @relation(fields: [modelId], references: [id])
  sampleId  String
  textDescription String? // Original text description
  pVuln     Float    // Probability of vulnerability [0, 1]
  cvss      Float?   // CVSS base score [0, 10]
  riskScore Float    // Calculated risk score [0, 1]
  riskLevel String   // "Low" | "Medium" | "High" | "Critical"
  createdAt DateTime @default(now())

  @@map("predictions")
  @@index([modelId])
  @@index([sampleId])
}
```

**字段说明**:
- `id`: 主键，UUID格式
- `modelId`: 关联的模型ID
- `sampleId`: 样本ID
- `textDescription`: 原始文本描述
- `pVuln`: 漏洞概率
- `cvss`: CVSS基础评分
- `riskScore`: 风险评分
- `riskLevel`: 风险等级

### 6.3 关系设计

- **MLModel ↔ Prediction**: 一对多关系
- 一个模型可以有多个预测记录
- 预测记录必须关联一个模型

### 6.4 索引设计

- User表: `username`, `email` 唯一索引
- Prediction表: `modelId`, `sampleId` 索引，提高查询性能

---

## 7. API设计

### 7.1 API架构

采用RESTful API设计规范，所有API端点以 `/api` 为前缀。

### 7.2 认证API

#### 7.2.1 用户注册
```
POST /api/auth/register
Content-Type: application/json

Request Body:
{
  "username": "string",
  "email": "string",
  "password": "string"
}

Response:
{
  "token": "string",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

#### 7.2.2 用户登录
```
POST /api/auth/login
Content-Type: application/json

Request Body:
{
  "username": "string",
  "password": "string"
}

Response:
{
  "token": "string",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

#### 7.2.3 获取当前用户
```
GET /api/auth/me
Authorization: Bearer <token>

Response:
{
  "id": "string",
  "username": "string",
  "email": "string",
  "role": "string"
}
```

### 7.3 数据集API

#### 7.3.1 上传数据集
```
POST /api/datasets
Authorization: Bearer <token>
Content-Type: multipart/form-data

Request Body:
- file: File (CSV or JSON)

Response:
{
  "id": "string",
  "name": "string",
  "schema": {},
  "recordCount": 0,
  "createdAt": "string"
}
```

#### 7.3.2 获取数据集列表
```
GET /api/datasets
Authorization: Bearer <token>

Response:
[
  {
    "id": "string",
    "name": "string",
    "recordCount": 0,
    "createdAt": "string"
  }
]
```

### 7.4 模型API

#### 7.4.1 获取模型列表
```
GET /api/models
Authorization: Bearer <token>

Response:
[
  {
    "id": "string",
    "type": "string",
    "metrics": {},
    "isActive": boolean,
    "createdAt": "string"
  }
]
```

#### 7.4.2 获取模型详情
```
GET /api/models/:id
Authorization: Bearer <token>

Response:
{
  "id": "string",
  "type": "string",
  "metrics": {},
  "metadata": {},
  "isActive": boolean,
  "createdAt": "string"
}
```

#### 7.4.3 激活模型
```
POST /api/models/:id/activate
Authorization: Bearer <token>

Response:
{
  "id": "string",
  "isActive": true
}
```

### 7.5 预测API

#### 7.5.1 单样本预测
```
POST /api/predictions
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "sample_id": "string",
  "text_description": "string",
  "cvss_base_score": number (optional),
  "modelId": "string" (optional)
}

Response:
{
  "id": "string",
  "sampleId": "string",
  "pVuln": 0.85,
  "cvss": 7.5,
  "riskScore": 0.78,
  "riskLevel": "High",
  "createdAt": "string"
}
```

#### 7.5.2 批量预测(JSON)
```
POST /api/predictions/batch
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "samples": [
    {
      "sample_id": "string",
      "text_description": "string",
      "cvss_base_score": number (optional)
    }
  ],
  "modelId": "string" (optional)
}

Response:
{
  "predictions": [...],
  "count": 10
}
```

#### 7.5.3 批量预测(文件上传)
```
POST /api/predictions/batch/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Request Body:
- file: File (JSON, CSV, or Excel)

Response:
{
  "predictions": [...],
  "count": 10
}
```

#### 7.5.4 获取预测列表
```
GET /api/predictions?limit=20&offset=0
Authorization: Bearer <token>

Response:
[
  {
    "id": "string",
    "sampleId": "string",
    "pVuln": 0.85,
    "riskScore": 0.78,
    "riskLevel": "High",
    "createdAt": "string"
  }
]
```

#### 7.5.5 获取预测详情
```
GET /api/predictions/:id
Authorization: Bearer <token>

Response:
{
  "id": "string",
  "sampleId": "string",
  "textDescription": "string",
  "pVuln": 0.85,
  "cvss": 7.5,
  "riskScore": 0.78,
  "riskLevel": "High",
  "model": {...},
  "createdAt": "string"
}
```

#### 7.5.6 导出预测结果
```
GET /api/predictions/export?format=csv&limit=100&offset=0
Authorization: Bearer <token>

Response:
Content-Type: text/csv (or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet or application/json)
Content-Disposition: attachment; filename="predictions_2024-01-15T10-30-45.csv"
```

### 7.6 健康检查API

```
GET /api/health

Response:
{
  "status": "ok",
  "timestamp": "string"
}
```

### 7.7 错误处理

所有API错误响应格式:
```json
{
  "error": "Error message"
}
```

HTTP状态码:
- `200`: 成功
- `400`: 请求错误
- `401`: 未认证
- `403`: 无权限
- `404`: 资源不存在
- `500`: 服务器错误

---

## 8. 前端设计

### 8.1 页面结构

#### 8.1.1 登录页面 (`/login`)
- 用户登录表单
- 用户注册表单
- 错误提示

#### 8.1.2 数据集页面 (`/datasets`) - 仅管理员
- 数据集上传
- 数据集列表
- 数据集详情

#### 8.1.3 模型页面 (`/models`)
- 模型列表展示
- 模型激活
- 模型详情对话框
- 指标可视化

#### 8.1.4 预测页面 (`/predictions`)
- 单样本预测表单
- 批量预测文件上传
- 预测结果表格
- 结果导出功能
- 分页支持

#### 8.1.5 报告页面 (`/predictions/:id`)
- 预测详情展示
- 风险组件可视化
- 特征重要性分析
- 原始文本展示

### 8.2 组件设计

#### 8.2.1 路由守卫
- 认证检查
- 角色权限检查
- 自动重定向

#### 8.2.2 状态管理
- 用户认证状态
- Token管理
- 用户信息缓存

#### 8.2.3 数据可视化
- ECharts集成
- 风险组件柱状图
- 特征重要性横向柱状图
- 进度条展示

### 8.3 UI/UX设计

#### 8.3.1 设计原则
- 响应式设计
- 直观的用户界面
- 清晰的错误提示
- 加载状态反馈

#### 8.3.2 颜色方案
- 风险等级颜色映射:
  - Low: 绿色 (#67c23a)
  - Medium: 黄色 (#e6a23c)
  - High: 橙色 (#f56c6c)
  - Critical: 红色 (#f56c6c)

---

## 9. 安全与认证

### 9.1 认证机制

#### 9.1.1 JWT Token
- **算法**: HS256
- **有效期**: 7天
- **存储**: localStorage
- **刷新**: 无自动刷新，需重新登录

#### 9.1.2 密码安全
- **哈希算法**: bcrypt
- **轮数**: 10轮
- **存储**: 仅存储哈希值，不存储明文

### 9.2 授权机制

#### 9.2.1 角色定义
- **Admin**: 管理员，可访问所有功能
- **User**: 普通用户，可访问模型和预测功能

#### 9.2.2 路由保护
- 前端路由守卫检查认证状态
- 后端中间件验证JWT token
- 管理员路由需要额外权限检查

### 9.3 数据安全

#### 9.3.1 输入验证
- 所有用户输入进行验证
- SQL注入防护(Prisma ORM)
- XSS防护(前端转义)

#### 9.3.2 文件上传安全
- 文件类型验证
- 文件大小限制(100MB)
- 文件名清理

---

## 10. 部署方案

### 10.1 Docker容器化

#### 10.1.1 服务容器
- **postgres**: PostgreSQL数据库
- **backend-node**: Node.js后端服务
- **ml-service**: Python ML服务
- **frontend-vue**: Vue前端服务(Nginx)

#### 10.1.2 数据持久化
- PostgreSQL数据卷: `postgres_data`
- 模型文件: `./models` 目录挂载
- 上传文件: `./backend-node/uploads` 目录挂载

### 10.2 Docker Compose配置

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: vulnrisk
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend-node:
    build: ./backend-node
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/vulnrisk
      ML_SERVICE_URL: http://ml-service:5000
    ports:
      - "3000:3000"

  ml-service:
    build: ./ml-service
    environment:
      MODELS_DIR: /app/models
    ports:
      - "5000:5000"
    volumes:
      - ./models:/app/models

  frontend-vue:
    build: ./frontend-vue
    depends_on:
      - backend-node
    ports:
      - "80:80"
```

### 10.3 启动流程

1. **启动所有服务**:
   ```bash
   docker-compose up -d
   ```

2. **数据库迁移**:
   ```bash
   docker-compose exec backend-node npx prisma migrate deploy
   ```

3. **创建管理员用户**:
   ```bash
   docker-compose exec backend-node node scripts/create-admin.js
   ```

4. **注册模型**:
   ```bash
   docker-compose exec backend-node node scripts/register-model.js /app/models/risk_model_001
   ```

### 10.4 环境变量

#### 后端环境变量
- `DATABASE_URL`: PostgreSQL连接字符串
- `ML_SERVICE_URL`: ML服务URL
- `JWT_SECRET`: JWT签名密钥
- `PORT`: 服务端口(默认3000)

#### ML服务环境变量
- `MODELS_DIR`: 模型目录路径
- `DATA_DIR`: 数据目录路径
- `RISK_ALPHA`: 风险评分权重(默认0.6)
- `PORT`: 服务端口(默认5000)

---

## 11. 实验与评估

### 11.1 数据集

#### 11.1.1 数据来源
- CVE (Common Vulnerabilities and Exposures) 数据库
- 包含漏洞描述文本和CVSS评分

#### 11.1.2 数据特征
- 文本描述: 漏洞的详细描述
- CVSS评分: 0-10的数值评分
- 标签: 高风险/低风险二分类

### 11.2 模型评估

#### 11.2.1 评估指标
- **Accuracy**: 整体分类准确率
- **Precision**: 精确率，减少误报
- **Recall**: 召回率，减少漏报
- **F1 Score**: 精确率和召回率的调和平均
- **ROC-AUC**: ROC曲线下面积

#### 11.2.2 实验设置
- 训练集/测试集分割: 80/20
- 交叉验证: 5折交叉验证(可选)
- 随机种子: 42(确保可复现)

### 11.3 性能指标

#### 11.3.1 模型性能
- 训练时间: 取决于数据集大小和模型类型
- 预测时间: 单样本 < 100ms
- 批量预测: 1000样本 < 10s

#### 11.3.2 系统性能
- API响应时间: < 200ms (不含ML推理)
- 前端加载时间: < 2s
- 并发支持: 100+ 并发请求

---

## 12. 未来工作

### 12.1 功能增强

1. **模型训练界面**: 恢复管理员手动训练模型功能
2. **模型版本管理**: 支持模型版本控制和回滚
3. **实时预测**: WebSocket支持实时预测流
4. **批量导出筛选**: 支持按条件筛选导出数据
5. **邮件通知**: 预测结果邮件通知功能

### 12.2 算法优化

1. **深度学习模型**: 集成BERT等预训练模型
2. **特征工程**: 更复杂的特征提取方法
3. **模型集成**: 多模型集成提升性能
4. **在线学习**: 支持增量学习

### 12.3 系统优化

1. **缓存机制**: Redis缓存提升性能
2. **负载均衡**: 多实例部署和负载均衡
3. **监控告警**: 系统监控和告警机制
4. **日志系统**: 完整的日志记录和分析

### 12.4 用户体验

1. **移动端适配**: 响应式设计优化
2. **多语言支持**: 国际化支持
3. **主题切换**: 深色模式支持
4. **快捷键**: 键盘快捷键支持

---

## 附录

### A. 项目文件结构

```
vulnrisk/
├── backend-node/          # 后端服务
│   ├── src/
│   │   ├── app.ts        # Express应用
│   │   ├── server.ts     # 服务器入口
│   │   ├── config/       # 配置
│   │   ├── controllers/  # 控制器
│   │   ├── routes/       # 路由
│   │   ├── services/     # 业务逻辑
│   │   ├── middleware/   # 中间件
│   │   └── db/          # 数据库
│   ├── prisma/           # Prisma配置
│   └── scripts/          # 脚本工具
│
├── ml-service/           # ML服务
│   ├── app.py           # Flask应用
│   ├── train_risk_model.py  # 训练脚本
│   ├── predict.py       # 预测脚本
│   ├── risk.py          # 风险计算
│   └── requirements.txt # 依赖
│
├── frontend-vue/        # 前端服务
│   ├── src/
│   │   ├── views/       # 页面组件
│   │   ├── services/    # API服务
│   │   ├── stores/      # 状态管理
│   │   └── router/     # 路由
│   └── nginx.conf       # Nginx配置
│
├── models/              # 模型文件
├── data/                # 数据文件
├── docker-compose.yml   # Docker编排
└── README.md           # 项目说明
```

### B. 关键依赖版本

**后端**:
- Node.js: 18+
- TypeScript: 5.3.3
- Express: 4.18.2
- Prisma: 5.7.1

**ML服务**:
- Python: 3.11
- scikit-learn: 1.8.0+
- XGBoost: 2.0.0+

**前端**:
- Vue: 3.3.11
- Element Plus: 2.5.0
- ECharts: 5.4.3

### C. 参考文献

1. Breiman, L. (2001). Random forests. Machine learning, 45(1), 5-32.
2. Chen, T., & Guestrin, C. (2016). Xgboost: A scalable tree boosting system. Proceedings of the 22nd acm sigkdd international conference on knowledge discovery and data mining.
3. Chawla, N. V., et al. (2002). SMOTE: synthetic minority over-sampling technique. Journal of artificial intelligence research, 16, 321-357.
4. Platt, J. (1999). Probabilistic outputs for support vector machines and comparisons to regularized likelihood methods. Advances in large margin classifiers, 10(3), 61-74.

---

## 版本历史

- **v1.0.0** (2024-12): 初始版本
  - 完整的用户认证系统
  - 模型管理和预测功能
  - 批量预测和结果导出
  - Docker容器化部署

---

**文档结束**







