# 查看数据库指南

本项目使用PostgreSQL数据库，有多种方式可以查看数据库内容。

## 方法1: 使用Prisma Studio（推荐，最简单）

Prisma Studio是一个可视化的数据库浏览器，可以方便地查看和编辑数据。

### 在本地运行（需要Node.js环境）

```powershell
# 进入后端目录
cd backend-node

# 启动Prisma Studio
npx prisma studio
```

启动后，浏览器会自动打开 `http://localhost:5555`，你可以：
- 查看所有表（User, Dataset, MLModel, Prediction）
- 查看、编辑、删除记录
- 添加新记录

### 在Docker容器中运行

```powershell
# 进入后端容器并启动Prisma Studio
docker-compose exec backend-node npx prisma studio
```

注意：在Docker容器中运行时，需要从宿主机访问 `http://localhost:5555`，但可能需要配置端口映射。

## 方法2: 使用psql命令行工具

### 通过Docker容器访问

```powershell
# 进入PostgreSQL容器
docker-compose exec postgres psql -U postgres -d vulnrisk
```

进入后可以使用SQL命令：
```sql
-- 查看所有表
\dt

-- 查看用户表
SELECT * FROM users;

-- 查看模型表
SELECT id, type, "isActive", "createdAt" FROM ml_models;

-- 查看预测表（限制10条）
SELECT id, "sampleId", "pVuln", "riskScore", "riskLevel" FROM predictions LIMIT 10;

-- 查看数据集表
SELECT * FROM datasets;

-- 退出
\q
```

### 常用SQL查询

```sql
-- 统计各表记录数
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 
    'ml_models' as table_name, COUNT(*) as count FROM ml_models
UNION ALL
SELECT 
    'predictions' as table_name, COUNT(*) as count FROM predictions
UNION ALL
SELECT 
    'datasets' as table_name, COUNT(*) as count FROM datasets;

-- 查看激活的模型
SELECT id, type, metrics, "isActive" FROM ml_models WHERE "isActive" = true;

-- 查看最近的预测
SELECT 
    p.id,
    p."sampleId",
    p."pVuln",
    p."riskScore",
    p."riskLevel",
    p."createdAt",
    m.type as "modelType"
FROM predictions p
LEFT JOIN ml_models m ON p."modelId" = m.id
ORDER BY p."createdAt" DESC
LIMIT 20;

-- 按风险等级统计预测
SELECT 
    "riskLevel",
    COUNT(*) as count,
    AVG("pVuln") as avg_p_vuln,
    AVG("riskScore") as avg_risk_score
FROM predictions
GROUP BY "riskLevel"
ORDER BY count DESC;
```

## 方法3: 使用数据库管理工具

### pgAdmin（PostgreSQL官方工具）

1. 下载安装 pgAdmin: https://www.pgadmin.org/download/
2. 创建新服务器连接：
   - **Host**: localhost
   - **Port**: 5432
   - **Database**: vulnrisk
   - **Username**: postgres
   - **Password**: postgres

### DBeaver（跨平台数据库工具）

1. 下载安装 DBeaver: https://dbeaver.io/download/
2. 创建PostgreSQL连接：
   - **Host**: localhost
   - **Port**: 5432
   - **Database**: vulnrisk
   - **Username**: postgres
   - **Password**: postgres

### VS Code扩展

安装 "PostgreSQL" 或 "SQLTools" 扩展，可以直接在VS Code中连接和查询数据库。

## 方法4: 通过后端API查看

虽然不能直接查看数据库，但可以通过API获取数据：

```powershell
# 获取所有模型（需要先登录获取token）
curl -X GET "http://localhost:3000/api/models" -H "Authorization: Bearer <your-token>"

# 获取所有预测（需要先登录获取token）
curl -X GET "http://localhost:3000/api/predictions?limit=10" -H "Authorization: Bearer <your-token>"
```

## 数据库连接信息

- **Host**: localhost (或 Docker 服务名: postgres)
- **Port**: 5432
- **Database**: vulnrisk
- **Username**: postgres
- **Password**: postgres

## 快速查看命令

### 查看所有表

```powershell
docker-compose exec postgres psql -U postgres -d vulnrisk -c "\dt"
```

### 查看表结构

```powershell
# 查看users表结构
docker-compose exec postgres psql -U postgres -d vulnrisk -c "\d users"

# 查看ml_models表结构
docker-compose exec postgres psql -U postgres -d vulnrisk -c "\d ml_models"

# 查看predictions表结构
docker-compose exec postgres psql -U postgres -d vulnrisk -c "\d predictions"
```

### 快速统计

```powershell
# 统计各表记录数
docker-compose exec postgres psql -U postgres -d vulnrisk -c "
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'ml_models', COUNT(*) FROM ml_models
UNION ALL
SELECT 'predictions', COUNT(*) FROM predictions
UNION ALL
SELECT 'datasets', COUNT(*) FROM datasets;
"
```

## 注意事项

1. **确保Docker服务运行**: 所有方法都需要PostgreSQL容器正在运行
2. **端口访问**: 确保5432端口没有被其他程序占用
3. **权限**: 使用postgres用户有完全访问权限
4. **数据安全**: 在生产环境中，请使用强密码并限制访问

## 推荐方式

- **开发调试**: 使用 Prisma Studio（最简单直观）
- **快速查询**: 使用 psql 命令行
- **复杂分析**: 使用 pgAdmin 或 DBeaver
- **集成开发**: 使用 VS Code 扩展





