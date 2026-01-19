# 快速修复数据库连接问题

## 问题

后端服务报错：`Please make sure your database server is running at localhost:5432`

## 快速解决（3步）

### 步骤1: 启动 PostgreSQL

```powershell
# 方法1: 使用脚本（推荐）
.\start-postgres.ps1

# 方法2: 手动启动
docker-compose up -d postgres
```

### 步骤2: 运行数据库迁移

```powershell
cd backend-node
npx prisma migrate deploy
```

### 步骤3: 验证连接

```powershell
# 测试健康检查
curl http://localhost:3000/api/health
```

## 如果仍然失败

### 检查1: Docker Desktop 是否运行

```powershell
# 检查 Docker 进程
Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
```

### 检查2: PostgreSQL 容器是否运行

```powershell
docker ps --filter "name=postgres"
```

### 检查3: 端口是否被占用

```powershell
# 检查 5432 端口
netstat -ano | findstr :5432
```

### 检查4: .env 文件配置

确保 `backend-node/.env` 文件包含：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vulnrisk?schema=public"
```

## 完整启动流程

```powershell
# 1. 启动 PostgreSQL
docker-compose up -d postgres

# 2. 等待几秒让数据库启动
Start-Sleep -Seconds 5

# 3. 运行迁移
cd backend-node
npx prisma migrate deploy

# 4. 启动后端（如果还没启动）
npm run dev
```

## 验证

访问 `http://localhost:3000/api/health` 应该返回：

```json
{
  "status": "ok",
  "services": {
    "database": "ok"
  }
}
```











