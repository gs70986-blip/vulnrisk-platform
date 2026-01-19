# 数据库迁移说明

## 添加 explanation 和 metadata 字段

需要运行以下命令来应用数据库迁移：

```bash
cd backend-node
npx prisma migrate dev --name add_prediction_explanation_metadata
```

或者在生产环境：

```bash
cd backend-node
npx prisma migrate deploy
```

## 迁移内容

在 `predictions` 表中添加：
- `explanation` (String, nullable) - 用于存储 N/A 或 Uncertain 情况的说明
- `metadata` (Json, nullable) - 用于存储额外的元数据（applicable, reason, max_similarity, thresholds 等）

这些字段将允许在预测列表中显示 explanation 和 meta 信息。



