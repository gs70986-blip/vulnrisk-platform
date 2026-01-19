# 模型激活指南

## 概述

在使用模型进行预测之前，必须先将模型激活。只有激活的模型才能用于预测。

## 方法1: 使用前端界面（推荐）

1. 打开前端界面：http://localhost
2. 导航到"模型"页面
3. 找到要激活的模型
4. 点击"激活"按钮
5. 确认激活成功（模型状态变为"已激活"）

## 方法2: 使用后端API

### 激活模型

```bash
curl -X POST http://localhost:3000/api/models/{model_id}/activate
```

示例：
```bash
curl -X POST http://localhost:3000/api/models/risk_model_001/activate
```

### 检查激活状态

```bash
curl http://localhost:3000/api/models
```

响应中，`isActive: true` 表示模型已激活。

## 方法3: 使用注册脚本（注册时激活）

使用 `register-model.js` 脚本注册模型时，可以同时激活：

```bash
cd backend-node
node scripts/register-model.js ../ml-service/models/risk_model_001 risk_model_001 --activate
```

## 注意事项

1. **同时只能有一个激活的模型**：激活新模型时，会自动停用其他所有模型。

2. **激活状态持久化**：模型的激活状态保存在PostgreSQL数据库中，重启服务后仍然有效。

3. **预测前检查**：进行预测时，系统会自动使用激活的模型。如果没有激活的模型，预测会失败并提示"No active model found"。

## 故障排除

### 问题：找不到激活的模型

**解决方案**：
1. 检查是否有模型已注册：`curl http://localhost:3000/api/models`
2. 如果没有模型，先注册一个模型
3. 如果有模型但未激活，使用上述方法激活

### 问题：激活后仍然无法预测

**解决方案**：
1. 检查模型文件是否存在（在Docker容器内）
2. 检查模型路径是否正确
3. 查看后端日志：`docker-compose logs backend-node`
4. 查看ML服务日志：`docker-compose logs ml-service`

## 验证激活

激活后，可以通过以下方式验证：

```bash
# 检查激活的模型
curl http://localhost:3000/api/models | jq '.[] | select(.isActive == true)'
```

或者在前端界面查看模型列表，激活的模型会有特殊标记。











