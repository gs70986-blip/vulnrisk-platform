# 训练随机森林模型指南

## 步骤1: 准备训练配置

已创建配置文件: `ml-service/train_random_forest_config.json`

配置内容:
- 模型类型: RandomForest
- 使用SMOTE: true
- 输出目录: `/app/models/risk_model_003_rf`

## 步骤2: 启动Docker服务

```bash
docker-compose up -d
```

## 步骤3: 进入ML服务容器并训练模型

```bash
# 进入ML服务容器
docker-compose exec ml-service bash

# 在容器内执行训练
python train_risk_model.py train_random_forest_config.json
```

或者直接执行（不进入容器）:

```bash
docker-compose exec ml-service python train_risk_model.py train_random_forest_config.json
```

## 步骤4: 检查训练结果

训练完成后，模型文件将保存在:
- 容器内: `/app/models/risk_model_003_rf/`
- 本地: `./models/risk_model_003_rf/`

包含文件:
- `model.joblib` - 训练好的模型
- `vectorizer.joblib` - TF-IDF向量化器
- `metadata.json` - 模型元数据和指标
- `preprocessing_report.json` - 预处理报告
- `training_predictions.csv` - 训练集预测结果

## 步骤5: 注册模型到数据库

```bash
# 进入后端容器
docker-compose exec backend-node bash

# 注册模型（不激活）
node scripts/register-model.js /app/models/risk_model_003_rf risk_model_003_rf

# 或者注册并激活
node scripts/register-model.js /app/models/risk_model_003_rf risk_model_003_rf --activate
```

或者直接执行（不进入容器）:

```bash
# 注册模型
docker-compose exec backend-node node scripts/register-model.js /app/models/risk_model_003_rf risk_model_003_rf

# 注册并激活
docker-compose exec backend-node node scripts/register-model.js /app/models/risk_model_003_rf risk_model_003_rf --activate
```

## 步骤6: 验证模型注册

在前端访问 Models 页面，应该能看到新的 RandomForest 模型。

## 注意事项

1. 训练可能需要几分钟到几十分钟，取决于数据集大小
2. 确保有足够的磁盘空间存储模型文件
3. 如果训练失败，检查容器日志: `docker-compose logs ml-service`
4. 模型注册前确保数据库连接正常





