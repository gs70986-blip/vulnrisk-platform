# 修复数据库连接问题

## 问题描述

后端服务启动后报错：
```
Please make sure your database server is running at `localhost:5432`.
```

## 原因分析

后端服务在本地运行，但无法连接到 PostgreSQL 数据库。可能的原因：
1. PostgreSQL 服务未启动
2. PostgreSQL 端口不是 5432
3. 数据库连接配置不正确

## 解决方案

### 方案1: 使用 Docker Compose 启动 PostgreSQL（推荐）

1. **启动 PostgreSQL 服务**
   ```powershell
   docker-compose up -d postgres
   ```

2. **验证 PostgreSQL 是否运行**
   ```powershell
   docker ps --filter "name=vulnrisk-postgres"
   ```

3. **检查端口映射**
   确保 PostgreSQL 映射到 `localhost:5432`

4. **测试连接**
   ```powershell
   # 使用 psql 测试（如果已安装）
   psql -h localhost -p 5432 -U postgres -d vulnrisk
   # 密码: postgres
   ```

### 方案2: 确保本地 PostgreSQL 服务运行

1. **检查 PostgreSQL 服务状态（Windows）**
   ```powershell
   Get-Service postgresql*
   ```

2. **启动 PostgreSQL 服务**
   ```powershell
   Start-Service postgresql-x64-15  # 版本号可能不同
   ```

3. **验证端口**
   确保 PostgreSQL 监听在 5432 端口

### 方案3: 修改 .env 文件

如果 PostgreSQL 运行在不同的端口或主机，修改 `backend-node/.env` 文件：

```env
# 如果 PostgreSQL 在 Docker 中运行
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vulnrisk?schema=public"

# 如果 PostgreSQL 在远程服务器
DATABASE_URL="postgresql://postgres:postgres@your-host:5432/vulnrisk?schema=public"

# 如果使用不同的端口
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/vulnrisk?schema=public"
```

### 方案4: 创建数据库（如果不存在）

如果 PostgreSQL 正在运行但数据库不存在：

```powershell
# 使用 Docker 执行
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE vulnrisk;"

# 或使用本地 psql
psql -U postgres -c "CREATE DATABASE vulnrisk;"
```

### 方案5: 运行数据库迁移

确保数据库表已创建：

```powershell
cd backend-node
npx prisma migrate deploy
# 或
npx prisma migrate dev
```

## 验证连接

### 方法1: 使用健康检查端点

```powershell
curl http://localhost:3000/api/health
```

应该返回：
```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "mlService": "ok"
  }
}
```

### 方法2: 直接测试数据库连接

```powershell
# 在 backend-node 目录
npx prisma db pull
```

如果连接成功，会显示数据库结构。

## 常见错误

### 错误1: Connection refused

**原因**: PostgreSQL 服务未运行

**解决**: 
```powershell
# 启动 Docker PostgreSQL
docker-compose up -d postgres

# 或启动本地服务
Start-Service postgresql-x64-15
```

### 错误2: Authentication failed

**原因**: 用户名或密码错误

**解决**: 检查 `.env` 文件中的 `DATABASE_URL`，确保用户名和密码正确。

### 错误3: Database does not exist

**原因**: 数据库 `vulnrisk` 不存在

**解决**: 
```powershell
# 创建数据库
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE vulnrisk;"
```

### 错误4: Connection timeout

**原因**: 防火墙阻止连接或端口未映射

**解决**: 
1. 检查 Docker 端口映射：`docker ps` 查看端口映射
2. 检查防火墙设置
3. 确保 PostgreSQL 监听在正确的接口上

## 快速检查清单

- [ ] Docker Desktop 正在运行
- [ ] PostgreSQL 容器正在运行：`docker ps`
- [ ] 端口 5432 已映射：`docker ps` 显示 `0.0.0.0:5432->5432/tcp`
- [ ] `.env` 文件中的 `DATABASE_URL` 正确
- [ ] 数据库 `vulnrisk` 已创建
- [ ] 数据库迁移已运行：`npx prisma migrate deploy`

## 下一步

连接成功后，可以：
1. 注册模型：`node scripts/register-model.js ../ml-service/models/risk_model_001`
2. 测试 API：访问 `http://localhost:3000/api/health`
3. 使用前端界面进行预测











