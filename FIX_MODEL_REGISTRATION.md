# 模型注册脚本修复说明

## 问题描述

运行 `register-model.js` 脚本时出现错误：
```
Argument `type` is missing.
PrismaClientValidationError
```

## 问题原因

注册脚本中使用的字段名与 Prisma schema 不匹配：

1. **使用了 `modelType`**，但 schema 中字段名是 `type`
2. **使用了 `name` 字段**，但 schema 中没有此字段
3. **使用了 `version` 字段**，但 schema 中没有此字段

## Prisma Schema 定义

```prisma
model MLModel {
  id           String   @id @default(uuid())
  type         String   // "RandomForest" | "XGBoost"
  metrics      Json
  artifactPath String
  metadata     Json?
  isActive     Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## 修复内容

### 修复前（错误）

```javascript
const newModel = await prisma.mLModel.create({
    data: {
        id: finalModelId,
        name: modelName,              // ❌ 字段不存在
        modelType: metadata.model_type, // ❌ 应该是 type
        artifactPath: dockerPath,
        metrics: metadata.metrics,
        metadata: metadata,
        version: 1,                   // ❌ 字段不存在
        isActive: activate
    }
});
```

### 修复后（正确）

```javascript
const newModel = await prisma.mLModel.create({
    data: {
        id: finalModelId,
        type: metadata.model_type,     // ✅ 使用 type
        artifactPath: dockerPath,
        metrics: metadata.metrics,
        metadata: metadata,
        isActive: activate
        // ✅ 移除了 name 和 version 字段
    }
});
```

## 修复位置

修复了两个地方：
1. **创建新模型**（第 128-139 行）
2. **更新现有模型**（第 105-116 行）

## 使用方法

现在可以正常使用脚本注册模型：

```bash
# 注册模型（不激活）
node scripts/register-model.js ..\models\risk_model_001

# 注册模型并激活
node scripts/register-model.js ..\models\risk_model_001 risk_model_001 --activate
```

## 验证

注册成功后，可以通过以下方式验证：

1. **使用 Prisma Studio**:
   ```bash
   cd backend-node
   npx prisma studio
   ```
   查看 `ml_models` 表中的记录

2. **通过前端界面**:
   - 登录系统
   - 访问 Models 页面
   - 应该能看到注册的模型

3. **通过 API**:
   ```bash
   curl -X GET http://localhost:3000/api/models \
     -H "Authorization: Bearer <your-token>"
   ```

## 注意事项

1. 确保模型目录包含：
   - `model.joblib` - 模型文件
   - `metadata.json` - 元数据文件

2. 确保 `metadata.json` 包含：
   - `model_type` - 模型类型（"RandomForest" 或 "XGBoost"）
   - `metrics` - 性能指标对象

3. 模型路径会自动转换为 Docker 容器内的路径：
   - 本地路径: `../models/risk_model_001`
   - Docker 路径: `/app/models/risk_model_001`

## 相关文件

- `backend-node/scripts/register-model.js` - 注册脚本（已修复）
- `backend-node/prisma/schema.prisma` - 数据库 schema
- `backend-node/src/services/model.service.ts` - 模型服务








