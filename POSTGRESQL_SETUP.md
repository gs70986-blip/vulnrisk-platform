# PostgreSQL 运行指南

## 方法一：使用 Docker Compose（推荐，最简单）

这是项目推荐的方式，所有服务都会自动配置好。

### 前置要求
需要先安装 Docker Desktop for Windows

### 步骤

1. **确保 Docker Desktop 正在运行**
   - 打开 Docker Desktop 应用
   - 等待它完全启动（系统托盘图标不再转动）

2. **启动 PostgreSQL（使用项目配置）**
```powershell
# 在项目根目录
cd C:\Users\10944\Desktop\Project

# 只启动 PostgreSQL 服务
docker-compose up -d postgres
```

3. **验证数据库是否运行**
```powershell
# 查看服务状态
docker-compose ps
```

4. **或者启动所有服务（包括后端、ML服务、前端）**
```powershell
docker-compose up -d
```

---

## 方法二：使用 Docker（单独运行 PostgreSQL）

如果只想运行 PostgreSQL 而不使用 docker-compose：

### 步骤

1. **启动 PostgreSQL 容器**
```powershell
docker run --name vulnrisk-postgres ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=vulnrisk ^
  -p 5432:5432 ^
  -d postgres:15-alpine
```

2. **验证容器是否运行**
```powershell
docker ps
```

3. **查看日志（如果需要）**
```powershell
docker logs vulnrisk-postgres
```

4. **停止容器**
```powershell
docker stop vulnrisk-postgres
```

5. **启动已存在的容器**
```powershell
docker start vulnrisk-postgres
```

---

## 方法三：本地安装 PostgreSQL（传统方式）

### 步骤 1: 下载并安装 PostgreSQL

1. 访问 PostgreSQL 官网：https://www.postgresql.org/download/windows/
2. 下载 PostgreSQL 安装程序（推荐版本 15 或更高）
3. 运行安装程序：
   - 记住你设置的 `postgres` 用户密码
   - 端口默认 5432（如果不是，需要修改 `.env` 文件）
   - 选择安装 PostgreSQL Server

### 步骤 2: 启动 PostgreSQL 服务

#### 方式 A: 使用 Windows 服务管理器

1. 按 `Win + R`，输入 `services.msc`
2. 找到 `postgresql-x64-15`（版本号可能不同）
3. 右键点击 -> 启动

#### 方式 B: 使用 PowerShell

```powershell
# 查找 PostgreSQL 服务名称
Get-Service -Name "*postgres*"

# 启动服务（替换为实际的服务名称）
Start-Service postgresql-x64-15

# 检查状态
Get-Service postgresql-x64-15
```

### 步骤 3: 创建数据库

#### 方式 A: 使用 pgAdmin（图形界面）

1. 打开 pgAdmin（安装 PostgreSQL 时一起安装的）
2. 连接到 PostgreSQL 服务器（使用安装时设置的密码）
3. 右键点击 "Databases" -> "Create" -> "Database"
4. 名称输入：`vulnrisk`
5. 点击 "Save"

#### 方式 B: 使用命令行

```powershell
# 使用 psql（需要在 PATH 中）
psql -U postgres

# 在 psql 提示符下输入：
CREATE DATABASE vulnrisk;

# 退出
\q
```

#### 方式 C: 使用 PowerShell（一行命令）

```powershell
$env:PGPASSWORD='your_password'; psql -U postgres -c "CREATE DATABASE vulnrisk;"
```
（将 `your_password` 替换为你设置的密码）

### 步骤 4: 修改 .env 文件（如果需要）

如果使用不同的密码或端口，编辑 `backend-node/.env`：

```env
DATABASE_URL="postgresql://postgres:你的密码@localhost:5432/vulnrisk?schema=public"
```

---

## 验证 PostgreSQL 是否正常运行

### 检查端口是否监听

```powershell
Test-NetConnection -ComputerName localhost -Port 5432
```

如果显示 `TcpTestSucceeded : True`，说明 PostgreSQL 正在运行。

### 测试连接

```powershell
# 使用 psql（如果已安装）
psql -U postgres -d vulnrisk -c "SELECT version();"
```

---

## 快速选择指南

| 方法 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| Docker Compose | 最简单，自动配置所有服务 | 需要 Docker Desktop | **推荐用于开发** |
| Docker 单独运行 | 灵活，只运行数据库 | 需要 Docker，手动管理 | 只需要数据库时 |
| 本地安装 | 原生性能，永久安装 | 需要安装配置，占用系统资源 | 长期使用，生产环境 |

---

## 常见问题

### Q1: Docker 命令未找到

**解决：**
1. 安装 Docker Desktop for Windows
2. 下载地址：https://www.docker.com/products/docker-desktop/
3. 安装后重启 PowerShell

### Q2: 端口 5432 已被占用

**解决：**
```powershell
# 查找占用端口的进程
netstat -ano | findstr :5432

# 停止占用端口的进程（替换 PID）
taskkill /PID <进程ID> /F
```

或修改 `.env` 文件使用其他端口：
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/vulnrisk?schema=public"
```

### Q3: 连接被拒绝

**检查：**
1. PostgreSQL 服务是否运行
2. 端口是否正确
3. 防火墙是否阻止连接

### Q4: 认证失败

**解决：**
- 检查 `.env` 文件中的密码是否正确
- 如果忘记了密码，可以重置（需要管理员权限）

---

## 推荐方案

**对于本项目，强烈推荐使用 Docker Compose：**

```powershell
# 一键启动所有服务（包括 PostgreSQL、后端、ML服务、前端）
cd C:\Users\10944\Desktop\Project
docker-compose up -d
```

这样所有服务都会自动配置好，无需手动设置数据库。

















