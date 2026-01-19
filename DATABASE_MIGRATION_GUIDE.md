# 数据库迁移指南：添加 explanation 和 metadata 字段

## 修改内容

在 `backend-node/prisma/schema.prisma` 中的 `Prediction` 模型添加了两个字段：
- `explanation String?` - 用于存储 N/A 或 Uncertain 情况的说明
- `metadata Json?` - 用于存储额外的元数据（applicable, reason, max_similarity, thresholds 等）

## 迁移步骤

### 1. 生成 Prisma Client
```bash
cd backend-node
npx prisma generate
```

### 2. 创建并应用数据库迁移
```bash
cd backend-node
npx prisma migrate dev --name add_prediction_explanation_metadata
```

或者在生产环境：
```bash
cd backend-node
npx prisma migrate deploy
```

## 功能说明

迁移完成后：
- 预测列表接口 (`GET /api/predictions`) 将返回 `explanation` 和 `meta` 字段
- 新创建的预测会自动保存 `explanation` 和 `metadata` 到数据库
- 前端表格可以显示 `textDescription` 列，并在 N/A 时显示 explanation tooltip

## 注意事项

- 迁移前的预测记录不会自动填充 `explanation` 和 `metadata`（这些字段为可选）
- 迁移后新创建的预测会包含这些字段
- 如果迁移遇到问题，可以使用 `npx prisma migrate reset` 重置（会删除所有数据）



