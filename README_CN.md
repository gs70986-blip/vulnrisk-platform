# VulnRisk - 漏洞风险评估平台

一个基于机器学习的软件漏洞预测与风险评估全栈应用平台。

## 项目简介

VulnRisk 是一个完整的漏洞风险评估系统，通过机器学习模型预测漏洞概率，并结合 CVSS 基础分数计算综合风险评分，最终输出风险等级（低/中/高/严重）。

**系统定位：**
- 学术原型 + 工程可运行
- 支持论文复现与系统演示

## 系统架构

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Vue 3 前端   │ ───→ │ Node.js 后端 │ ───→ │ Python ML  │
│ (Element+)  │      │ (Express)   │      │ 服务        │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            ↓
                     ┌─────────────┐
                     │ PostgreSQL  │
                     │  数据库     │
                     └─────────────┘
```

### 技术栈

**后端**
- Node.js 18+
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL

**机器学习服务**
- Python 3.10+
- scikit-learn
- XGBoost
- imbalanced-learn

**前端**
- Vue 3
- TypeScript
- Element Plus
- ECharts

## 核心功能

### 1. 数据集管理
- 支持上传 CSV/JSON 格式数据集
- 自动分析数据集字段结构
- 数据集预处理验证
- 查看数据集详细信息

### 2. 模型训练
- 支持两种算法：RandomForest 和 XGBoost
- 可选的 SMOTE 不平衡数据处理
- 完整的评估指标：准确率、精确率、召回率、F1值、ROC-AUC
- 特征重要性分析
- 模型激活管理

### 3. 风险预测
- 单样本预测
- 批量预测
- 实时风险评分计算
- 风险等级自动分类

### 4. 风险报告
- 详细的风险分析报告
- 可视化图表展示
- 特征重要性可视化
- 风险评分分解

## 快速开始

### 方式一：Docker Compose（推荐）

#### 前置要求
- Docker
- Docker Compose

#### 启动步骤

1. **克隆项目并进入目录**
```bash
cd Project
```

2. **启动所有服务**
```bash
docker-compose up -d
```

3. **初始化数据库（首次运行）**
```bash
docker-compose exec backend-node npx prisma migrate deploy
```

4. **访问应用**
   - 前端界面：http://localhost
   - 后端API：http://localhost:3000
   - ML服务：http://localhost:5000/health

#### 停止服务
```bash
docker-compose down
```

#### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend-node
docker-compose logs -f ml-service
docker-compose logs -f frontend-vue
```

### 方式二：本地开发

#### 后端服务

1. **进入后端目录**
```bash
cd backend-node
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
创建 `.env` 文件：
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vulnrisk?schema=public"
PORT=3000
ML_SERVICE_URL="http://localhost:5000"
NODE_ENV="development"
```

4. **初始化数据库**
```bash
npx prisma generate
npx prisma migrate dev
```

5. **启动服务**
```bash
npm run dev
```

#### ML 服务

1. **进入ML服务目录**
```bash
cd ml-service
```

2. **安装依赖**
```bash
pip install -r requirements.txt
```

3. **启动服务**
```bash
python app.py
```

#### 前端服务

1. **进入前端目录**
```bash
cd frontend-vue
```

2. **安装依赖**
```bash
npm install
```

3. **启动开发服务器**
```bash
npm run dev
```

访问：http://localhost:5173

## 使用指南

### 1. 上传数据集

1. 登录前端界面，进入"数据集"页面
2. 点击"上传数据集"按钮
3. 选择 CSV 或 JSON 格式的数据文件
4. （可选）输入数据集名称
5. 点击"上传"

**数据集格式要求：**
```json
{
  "sample_id": "样本ID（字符串）",
  "text_description": "漏洞描述文本（必填）",
  "cvss_base_score": "CVSS基础分数 0-10（可选）",
  "label": "标签 0或1（训练时必填）"
}
```

**CSV 格式示例：**
```csv
sample_id,text_description,cvss_base_score,label
sample_001,"SQL注入漏洞，允许未授权访问数据库",9.8,1
sample_002,"XSS跨站脚本漏洞",6.1,1
sample_003,"正确的输入验证实现",0.0,0
```

### 2. 训练模型

1. 进入"模型"页面
2. 点击"训练模型"按钮
3. 填写训练参数：
   - **数据集**：选择已上传的数据集
   - **模型类型**：选择 RandomForest 或 XGBoost
   - **使用SMOTE**：是否使用SMOTE处理类别不平衡
   - **测试集比例**：默认 0.2（20%）
4. 点击"训练"按钮
5. 等待训练完成（可能需要几分钟）

**训练完成后：**
- 查看模型评估指标
- 查看特征重要性
- 激活模型以用于预测

### 3. 进行预测

#### 单样本预测

1. 进入"预测"页面
2. 点击"新建预测"按钮
3. 填写预测信息：
   - **样本ID**：输入样本标识
   - **文本描述**：输入漏洞描述文本
   - **CVSS基础分数**：（可选）输入 0-10 的分数
4. 点击"预测"按钮
5. 查看预测结果和风险等级

#### 批量预测

使用API进行批量预测（详见API文档）

### 4. 查看报告

1. 在预测列表中点击"查看"按钮
2. 查看详细的风险报告，包括：
   - 漏洞概率 P(vuln)
   - CVSS 分数
   - 综合风险评分
   - 风险等级
   - 原始文本描述
   - 特征重要性（Top 15）

## API 文档

### 数据集接口

#### 上传数据集
```http
POST /api/datasets
Content-Type: multipart/form-data

Body:
  file: <文件>
  name: <数据集名称（可选）>
```

**响应示例：**
```json
{
  "id": "uuid",
  "name": "漏洞数据集",
  "schema": {
    "fields": [...],
    "recordCount": 100
  },
  "recordCount": 100,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### 获取所有数据集
```http
GET /api/datasets
```

#### 获取数据集详情
```http
GET /api/datasets/:id
```

#### 预处理数据集
```http
POST /api/datasets/:id/preprocess
```

### 模型接口

#### 训练模型
```http
POST /api/models/train
Content-Type: application/json

Body:
{
  "datasetId": "uuid",
  "modelType": "RandomForest" | "XGBoost",
  "useSmote": false,
  "testSize": 0.2,
  "randomState": 42
}
```

**响应示例：**
```json
{
  "id": "uuid",
  "type": "RandomForest",
  "metrics": {
    "accuracy": 0.85,
    "precision": 0.82,
    "recall": 0.80,
    "f1": 0.81,
    "roc_auc": 0.89
  },
  "artifactPath": "/app/models/uuid/model.joblib",
  "metadata": {
    "feature_importance": [...]
  },
  "isActive": false
}
```

#### 获取所有模型
```http
GET /api/models
```

#### 激活模型
```http
POST /api/models/:id/activate
```

### 预测接口

#### 单样本预测
```http
POST /api/predictions
Content-Type: application/json

Body:
{
  "sample_id": "sample_001",
  "text_description": "SQL注入漏洞描述...",
  "cvss_base_score": 9.8,
  "modelId": "uuid（可选，默认使用激活的模型）"
}
```

**响应示例：**
```json
{
  "id": "uuid",
  "modelId": "uuid",
  "sampleId": "sample_001",
  "textDescription": "SQL注入漏洞描述...",
  "pVuln": 0.92,
  "cvss": 9.8,
  "riskScore": 0.94,
  "riskLevel": "Critical",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### 批量预测
```http
POST /api/predictions/batch
Content-Type: application/json

Body:
{
  "samples": [
    {
      "sample_id": "sample_001",
      "text_description": "...",
      "cvss_base_score": 9.8
    },
    ...
  ],
  "modelId": "uuid（可选）"
}
```

#### 获取预测列表
```http
GET /api/predictions?limit=100&offset=0
```

#### 获取预测详情
```http
GET /api/predictions/:id
```

### 健康检查

```http
GET /api/health
```

## 风险评估说明

### 风险计算公式

系统使用以下公式计算综合风险评分：

```
如果提供了 CVSS 分数：
    risk_score = α × P(vuln) + β × (CVSS / 10)
否则：
    risk_score = P(vuln)
```

其中：
- `P(vuln)`：机器学习模型预测的漏洞概率 [0, 1]
- `CVSS`：CVSS 基础分数 [0, 10]
- `α`：概率权重，默认 0.6
- `β`：CVSS权重，默认 0.4
- 约束条件：α + β = 1

### 风险等级划分

| 风险评分 | 风险等级 | 说明 |
|---------|---------|------|
| < 0.40 | 低 (Low) | 风险较低，建议关注 |
| 0.40 - 0.69 | 中 (Medium) | 中等风险，需要处理 |
| 0.70 - 0.89 | 高 (High) | 高风险，优先处理 |
| ≥ 0.90 | 严重 (Critical) | 严重风险，立即处理 |

## 配置说明

### 环境变量

#### 后端服务 (backend-node)
- `DATABASE_URL`：PostgreSQL 连接字符串
- `PORT`：服务端口（默认：3000）
- `ML_SERVICE_URL`：ML服务地址（默认：http://ml-service:5000）
- `NODE_ENV`：运行环境（development/production）

#### ML 服务 (ml-service)
- `MODELS_DIR`：模型存储目录（默认：/app/models）
- `DATA_DIR`：数据集目录（默认：/app/data）
- `RISK_ALPHA`：风险计算α参数（默认：0.6）
- `RISK_BETA`：风险计算β参数（默认：0.4）

### 配置文件

编辑 `config.yaml` 可以调整风险计算参数：

```yaml
risk_calculation:
  alpha: 0.6
  beta: 0.4

ml_service:
  timeout: 300  # 秒
  max_features: 20000
```

## 常见问题

### Q1: 训练模型时出现错误

**可能原因：**
- 数据集格式不正确
- 数据集缺少必需字段（text_description, label）
- 内存不足

**解决方案：**
- 检查数据集格式是否符合要求
- 确保所有样本都有 text_description 和 label 字段
- 尝试使用较小的数据集或增加系统内存

### Q2: 预测结果不准确

**可能原因：**
- 训练数据质量不高
- 模型未充分训练
- 预测数据与训练数据分布差异大

**解决方案：**
- 使用更多、更高质量的训练数据
- 尝试不同的模型类型（RandomForest 或 XGBoost）
- 使用 SMOTE 处理类别不平衡
- 检查特征工程和预处理步骤

### Q3: 服务无法启动

**可能原因：**
- Docker 服务未运行
- 端口被占用
- 数据库连接失败

**解决方案：**
```bash
# 检查 Docker 状态
docker ps

# 检查端口占用
netstat -ano | findstr :3000
netstat -ano | findstr :5000
netstat -ano | findstr :5432

# 查看服务日志
docker-compose logs -f backend-node
```

### Q4: 前端无法访问后端API

**可能原因：**
- 跨域配置问题
- 后端服务未启动
- 代理配置错误

**解决方案：**
- 检查后端服务是否正常运行
- 检查 nginx.conf 中的代理配置
- 查看浏览器控制台的错误信息

### Q5: 数据库迁移失败

**解决方案：**
```bash
# 重新运行迁移
docker-compose exec backend-node npx prisma migrate deploy

# 或者重置数据库
docker-compose down -v
docker-compose up -d postgres
# 等待几秒后
docker-compose exec backend-node npx prisma migrate deploy
```

## 数据示例

项目根目录包含 `sample_dataset.json` 文件，提供了示例训练数据，包含10个样本，可用于测试系统功能。

## 项目结构

详细的项目结构说明请参考 [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

## 开发说明

### 代码规范
- 后端：TypeScript + ESLint
- 前端：Vue 3 + TypeScript
- ML服务：Python PEP 8

### 测试
目前代码库为原型版本，建议在实际使用前添加单元测试和集成测试。

### 扩展功能
- 支持更多机器学习算法
- 添加模型版本管理
- 实现用户认证和权限管理
- 添加数据导出功能
- 支持更多数据格式

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过 GitHub Issues 反馈。

















