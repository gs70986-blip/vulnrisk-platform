# 快速模型注册指南

## 概述

训练好模型后，需要将其注册到PostgreSQL数据库中，才能通过API进行预测。

## 快速开始

### 1. 确保模型已训练

模型应该包含以下文件：
- `model.joblib` - 训练好的模型
- `vectorizer.joblib` - TF-IDF向量化器
- `metadata.json` - 模型元数据

### 2. 注册模型

```bash
cd backend-node
node scripts/register-model.js ../ml-service/models/risk_model_001
```

### 3. 指定模型ID（可选）

```bash
node scripts/register-model.js ../ml-service/models/risk_model_001 risk_model_001
```

### 4. 注册并激活（推荐）

```bash
node scripts/register-model.js ../ml-service/models/risk_model_001 risk_model_001 --activate
```

## 完整示例

```bash
# 1. 进入后端目录
cd backend-node

# 2. 注册模型（使用默认ID）
node scripts/register-model.js ../ml-service/models/risk_model_001

# 3. 或者指定ID并激活
node scripts/register-model.js ../ml-service/models/risk_model_001 risk_model_001 --activate
```

## 验证注册

### 方法1: 使用API

```bash
curl http://localhost:3000/api/models
```

### 方法2: 使用前端界面

访问 http://localhost，进入"模型"页面查看已注册的模型。

## 常见问题

### Q: 模型路径错误

**A**: 确保使用相对于项目根目录的路径，或者绝对路径。脚本会自动转换为Docker容器内的路径。

### Q: 数据库连接失败

**A**: 
1. 确保PostgreSQL服务正在运行：`docker-compose ps`
2. 检查 `.env` 文件中的 `DATABASE_URL`
3. 确保已运行数据库迁移：`docker-compose exec backend-node npx prisma migrate deploy`

### Q: 模型文件不存在

**A**: 
1. 检查模型目录是否存在
2. 确保模型文件已训练完成
3. 检查文件路径是否正确

## 下一步

注册模型后：
1. 激活模型（如果注册时未激活）
2. 使用前端或API进行预测测试











