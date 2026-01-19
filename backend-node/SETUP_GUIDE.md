# 本地开发环境设置指南

## 解决 DATABASE_URL 环境变量问题

### 步骤 1: 创建 .env 文件

在 `backend-node` 目录下创建 `.env` 文件（如果还没有的话），内容如下：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vulnrisk?schema=public"
PORT=3000
ML_SERVICE_URL="http://localhost:5000"
NODE_ENV="development"
```

**注意：** 根据你的 PostgreSQL 配置修改以下参数：
- `postgres:postgres` - 用户名:密码
- `localhost:5432` - 主机:端口
- `vulnrisk` - 数据库名称

### 步骤 2: 确保 PostgreSQL 正在运行

#### Windows (使用 pgAdmin 或命令行)

1. **检查 PostgreSQL 服务是否运行：**
```powershell
Get-Service postgresql*
```

2. **如果服务未运行，启动服务：**
```powershell
Start-Service postgresql-x64-15  # 版本号可能不同
```

3. **或者使用 Docker 运行 PostgreSQL：**
```bash
docker run --name vulnrisk-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vulnrisk -p 5432:5432 -d postgres:15-alpine
```

### 步骤 3: 创建数据库

如果数据库 `vulnrisk` 不存在，需要先创建：

**方法 1: 使用 psql 命令行**
```bash
psql -U postgres
CREATE DATABASE vulnrisk;
\q
```

**方法 2: 使用 pgAdmin**
- 打开 pgAdmin
- 连接到 PostgreSQL 服务器
- 右键点击 "Databases" -> "Create" -> "Database"
- 名称输入 `vulnrisk`
- 点击 "Save"

### 步骤 4: 运行 Prisma 迁移

在 `backend-node` 目录下：

```bash
# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev
```

### 步骤 5: 验证设置

如果一切正常，你应该看到类似以下的输出：

```
✔ Generated Prisma Client
✔ Applied migration: 20240101000000_init
```

### 常见问题

#### Q1: 连接被拒绝 (Connection refused)

**原因：** PostgreSQL 服务未运行

**解决：**
```powershell
# Windows
Start-Service postgresql-x64-15

# 或使用 Docker
docker start vulnrisk-postgres
```

#### Q2: 认证失败 (Authentication failed)

**原因：** 用户名或密码错误

**解决：** 修改 `.env` 文件中的 `DATABASE_URL`，使用正确的用户名和密码

#### Q3: 数据库不存在 (Database does not exist)

**原因：** 数据库 `vulnrisk` 还未创建

**解决：**
```sql
CREATE DATABASE vulnrisk;
```

#### Q4: 使用不同的 PostgreSQL 配置

如果你的 PostgreSQL 配置不同，修改 `.env` 文件：

```env
# 示例：使用不同的用户名和密码
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/vulnrisk?schema=public"

# 示例：使用不同的端口
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/vulnrisk?schema=public"
```

### 使用 Docker Compose（推荐）

如果你想避免本地 PostgreSQL 配置问题，可以使用 Docker Compose：

```bash
# 在项目根目录
docker-compose up -d postgres

# 等待几秒让数据库启动
# 然后运行迁移
docker-compose exec backend-node npx prisma migrate deploy
```

或直接启动所有服务：

```bash
docker-compose up -d
```

















