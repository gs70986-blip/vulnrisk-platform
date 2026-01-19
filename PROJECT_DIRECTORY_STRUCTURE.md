# 项目目录结构

## 根目录
```
Project/
├── backend-node/          # Node.js 后端服务
├── frontend-vue/          # Vue 3 前端应用
├── ml-service/            # Python ML 服务
├── models/                # 训练好的模型文件
├── data/                  # 数据集文件存储
├── test_data/             # 测试数据
├── docker-compose.yml     # Docker 编排配置
├── config.yaml            # 配置文件
│
├── README.md              # 英文文档
├── README_CN.md           # 中文文档
├── PROJECT_STRUCTURE.md   # 项目结构说明
├── PROJECT_DIRECTORY_STRUCTURE.md  # 目录结构（本文件）
│
├── sample_dataset.json    # 示例数据集
│
└── [各种配置和脚本文件]
    ├── start.sh / start.bat
    ├── rebuild-frontend.sh / rebuild-frontend.bat
    └── [其他文档和配置文件]
```

---

## backend-node/ - 后端服务

```
backend-node/
├── src/
│   ├── app.ts                    # Express 应用入口
│   ├── server.ts                 # 服务器启动文件
│   │
│   ├── config/
│   │   └── index.ts              # 配置管理
│   │
│   ├── db/
│   │   └── index.ts              # Prisma 数据库客户端
│   │
│   ├── middleware/
│   │   └── auth.middleware.ts    # JWT 认证中间件
│   │
│   ├── routes/                   # 路由定义
│   │   ├── auth.ts               # 认证路由
│   │   ├── datasets.ts           # 数据集路由
│   │   ├── models.ts             # 模型路由
│   │   ├── predictions.ts        # 预测路由
│   │   ├── github.ts             # GitHub 抓取路由（新增）
│   │   └── health.ts             # 健康检查路由
│   │
│   ├── controllers/              # 控制器层
│   │   ├── auth.controller.ts
│   │   ├── dataset.controller.ts
│   │   ├── model.controller.ts
│   │   ├── prediction.controller.ts
│   │   └── github.controller.ts  # GitHub 控制器（新增）
│   │
│   ├── services/                 # 业务逻辑层
│   │   ├── auth.service.ts       # 认证服务
│   │   ├── dataset.service.ts    # 数据集服务
│   │   ├── model.service.ts      # 模型服务
│   │   ├── prediction.service.ts # 预测服务
│   │   ├── risk.service.ts       # 风险计算服务
│   │   └── github.service.ts     # GitHub 抓取服务（新增）
│   │
│   └── utils/
│       └── ensureDirs.ts         # 工具函数
│
├── prisma/                       # Prisma ORM
│   ├── schema.prisma             # 数据库模式定义
│   └── migrations/               # 数据库迁移文件
│       ├── 20240101000000_init/
│       │   └── migration.sql
│       └── 20251230143712_add_user_model/
│           └── migration.sql
│
├── scripts/                      # 脚本文件
│   ├── create-admin.js
│   ├── register-model.js
│   ├── reset-password.js
│   └── verify-password.js
│
├── uploads/                      # 文件上传目录
│
├── package.json
├── package-lock.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

---

## frontend-vue/ - 前端应用

```
frontend-vue/
├── src/
│   ├── main.ts                   # 应用入口
│   ├── App.vue                   # 根组件
│   ├── vite-env.d.ts            # TypeScript 类型定义
│   │
│   ├── router/
│   │   └── index.ts              # Vue Router 配置
│   │
│   ├── stores/                   # Pinia 状态管理
│   │   └── auth.ts               # 认证状态
│   │
│   ├── services/                 # API 服务
│   │   └── api.ts                # Axios API 客户端
│   │
│   └── views/                    # 页面组件
│       ├── Login.vue             # 登录页
│       ├── Datasets.vue          # 数据集管理页
│       ├── Models.vue            # 模型管理页
│       ├── Predictions.vue       # 预测页（包含 GitHub 抓取功能）
│       └── Report.vue            # 报告详情页
│
├── public/                       # 静态资源
│   ├── batch_prediction_example.csv
│   ├── batch_prediction_example.json
│   └── test_data/
│       └── test_samples.json
│
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                # Vite 配置
├── index.html                    # HTML 入口
├── nginx.conf                    # Nginx 配置（生产环境）
├── Dockerfile
└── README.md
```

---

## ml-service/ - 机器学习服务

```
ml-service/
├── app.py                        # Flask API 服务主文件
├── train.py                      # 模型训练脚本
├── predict.py                    # 独立预测脚本
├── risk.py                       # 风险计算模块（包含 CVSS 估算）
│
├── models/                       # 本地模型存储
│   └── risk_model_001/
│       ├── model.joblib          # 训练好的模型
│       ├── vectorizer.joblib     # TF-IDF 向量化器
│       ├── metadata.json         # 模型元数据
│       ├── preprocessing_report.json
│       └── training_predictions.csv
│
├── requirements.txt              # Python 依赖
├── Dockerfile
├── README.md
│
└── [其他配置和工具脚本]
    ├── train_config.json
    ├── train_random_forest_config.json
    ├── train_with_smote_config.json
    ├── data_exploration.py
    ├── infer_unseen_risk.py
    └── plot_risk_analysis.py
```

---

## models/ - 模型存储（共享）

```
models/
├── risk_model_001/
│   ├── model.joblib
│   ├── vectorizer.joblib
│   ├── metadata.json
│   ├── preprocessing_report.json
│   └── training_predictions.csv
│
├── risk_model_002_smote/
│   └── [相同结构]
│
└── risk_model_003_rf/
    └── [相同结构]
```

---

## data/ - 数据集存储

```
data/
└── {dataset-id}/                 # 每个数据集一个目录
    └── data.json                 # 数据集数据文件
```

---

## test_data/ - 测试数据

```
test_data/
├── example_batch_data.json
├── test_samples.csv
└── test_samples.json
```

---

## 主要配置文件

### 根目录配置文件
- `docker-compose.yml` - Docker Compose 配置
- `config.yaml` - 全局配置文件

### 后端配置
- `backend-node/tsconfig.json` - TypeScript 配置
- `backend-node/package.json` - Node.js 依赖

### 前端配置
- `frontend-vue/vite.config.ts` - Vite 构建配置
- `frontend-vue/tsconfig.json` - TypeScript 配置
- `frontend-vue/package.json` - 前端依赖

### ML 服务配置
- `ml-service/requirements.txt` - Python 依赖

---

## 核心功能模块说明

### 后端模块

1. **认证模块** (`auth.*`)
   - JWT 基于 token 的认证
   - 用户注册/登录
   - 角色管理（admin/user）

2. **数据集模块** (`dataset.*`)
   - 数据集上传（CSV/JSON）
   - 数据集预处理
   - 数据集管理

3. **模型模块** (`model.*`)
   - 模型训练（调用 ML 服务）
   - 模型激活
   - 模型管理

4. **预测模块** (`prediction.*`)
   - 单样本预测
   - 批量预测
   - 预测历史查询
   - 预测结果导出

5. **GitHub 模块** (`github.*`) - **新增**
   - GitHub Issue/PR/Commit 文本抓取
   - 批量抓取
   - 缓存机制

### 前端模块

1. **认证页面** (`Login.vue`)
   - 用户登录
   - 用户注册

2. **数据集管理** (`Datasets.vue`)
   - 数据集上传
   - 数据集列表
   - 数据集预处理

3. **模型管理** (`Models.vue`)
   - 模型训练
   - 模型列表
   - 模型激活
   - 模型详情

4. **预测页面** (`Predictions.vue`)
   - 单样本预测
   - 批量预测
   - GitHub 文本抓取（单个/批量）**新增**
   - 预测历史
   - 结果导出

5. **报告页面** (`Report.vue`)
   - 预测结果详情展示

### ML 服务模块

1. **训练模块** (`train.py`)
   - RandomForest 训练
   - XGBoost 训练
   - SMOTE 支持
   - 模型评估

2. **预测模块** (`app.py`, `predict.py`)
   - 单样本预测
   - 批量预测
   - 风险评分计算
   - CVSS 估算（基于相似度）**新增**

3. **风险计算** (`risk.py`)
   - 风险评分计算
   - 风险等级映射
   - CVSS 相似度估算**新增**
   - CVSS p_vuln 后备映射

---

## 数据流向

### 预测流程
```
用户输入 → 前端 (Predictions.vue)
         → 后端 (prediction.controller.ts)
         → ML 服务 (app.py)
         → 模型预测 + CVSS 估算
         → 返回结果
         → 保存到数据库
         → 追加到训练数据集
```

### GitHub 抓取流程
```
用户输入 GitHub URL → 前端 (Predictions.vue)
                   → 后端 (github.controller.ts)
                   → GitHub 服务 (github.service.ts)
                   → 调用 GitHub API
                   → 缓存结果
                   → 返回文本内容
                   → 填充预测表单
```

### 训练流程
```
上传数据集 → 后端 (dataset.service.ts)
          → 保存数据文件
          → 调用 ML 服务训练
          → 保存模型文件
          → 更新数据库
```

---

## 数据库模型

### Dataset
- id, name, schema, recordCount, createdAt, updatedAt

### MLModel
- id, type, metrics, artifactPath, metadata, isActive, createdAt, updatedAt

### Prediction
- id, modelId, sampleId, textDescription, pVuln, cvss, riskScore, riskLevel, createdAt

### User
- id, username, email, password, role, createdAt, updatedAt

---

## API 端点

### 认证
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### 数据集
- POST /api/datasets (上传)
- GET /api/datasets (列表)
- GET /api/datasets/:id (详情)
- POST /api/datasets/:id/preprocess (预处理)

### 模型
- POST /api/models/train (训练)
- GET /api/models (列表)
- GET /api/models/:id (详情)
- POST /api/models/:id/activate (激活)

### 预测
- POST /api/predictions (单样本)
- POST /api/predictions/batch (批量)
- POST /api/predictions/batch/upload (文件上传)
- GET /api/predictions (列表)
- GET /api/predictions/:id (详情)
- GET /api/predictions/export (导出)

### GitHub **新增**
- POST /api/github/fetch (单个抓取)
- POST /api/github/fetch-batch (批量抓取)

### 健康检查
- GET /api/health

---

## 环境变量

### 后端 (backend-node)
- `DATABASE_URL` - PostgreSQL 连接字符串
- `PORT` - 服务端口（默认 3000）
- `ML_SERVICE_URL` - ML 服务地址（默认 http://localhost:5000）
- `JWT_SECRET` - JWT 密钥
- `JWT_EXPIRES_IN` - JWT 过期时间
- `GITHUB_TOKEN` - GitHub API Token（可选）**新增**

### ML 服务 (ml-service)
- `PORT` - 服务端口（默认 5000）
- `MODELS_DIR` - 模型目录（默认 /app/models）
- `DATA_DIR` - 数据目录（默认 /app/data）
- `RISK_ALPHA` - 风险评分权重（默认 0.6）

---

## 新增功能说明

### GitHub 文本抓取功能（最新添加）
- **后端服务**: `github.service.ts`, `github.controller.ts`, `routes/github.ts`
- **前端组件**: `Predictions.vue` 中的 GitHub 抓取卡片
- **API 端点**: `/api/github/fetch`, `/api/github/fetch-batch`
- **功能特性**:
  - 支持 Issue/PR/Commit 三种类型
  - 批量抓取支持
  - 10 分钟内存缓存
  - 文本限长 12000 字符
  - 自动填充预测表单

### CVSS 自动估算功能（最新添加）
- **ML 服务**: `risk.py` 中的 `estimate_cvss_from_similarity()`
- **功能特性**:
  - 基于训练数据文本相似度估算
  - 使用余弦相似度找到最相似样本
  - 加权平均 CVSS 值
  - 后备 p_vuln 映射机制

### 预测数据自动保存到训练集（最新添加）
- **后端服务**: `prediction.service.ts` 和 `dataset.service.ts`
- **功能特性**:
  - 预测时自动追加到训练数据集
  - 自动创建 "Training Data from Predictions" 数据集
  - 根据 p_vuln 自动生成 label

---

## 技术栈

### 后端
- Node.js 18+
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- Axios
- JWT (jsonwebtoken)
- Multer (文件上传)

### 前端
- Vue 3
- TypeScript
- Element Plus
- Vue Router
- Pinia (状态管理)
- Axios
- ECharts (图表)

### ML 服务
- Python 3.10+
- Flask
- scikit-learn
- XGBoost
- imbalanced-learn (SMOTE)
- joblib (模型序列化)
- pandas, numpy

---

## 部署相关

### Docker
- `docker-compose.yml` - 容器编排
- `backend-node/Dockerfile` - 后端镜像
- `frontend-vue/Dockerfile` - 前端镜像
- `ml-service/Dockerfile` - ML 服务镜像

### 启动脚本
- `start.sh` / `start.bat` - 启动脚本
- `rebuild-frontend.sh` / `rebuild-frontend.bat` - 前端重建脚本

---

*最后更新: 2024年*



