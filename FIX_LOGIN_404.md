# 修复登录404错误指南

## 问题分析

登录时出现404错误，可能的原因：

1. **API路由问题** - 前端请求的URL不正确
2. **后端服务未运行** - 后端服务没有正常启动
3. **代理配置问题** - 前端代理配置不正确
4. **用户不存在或密码错误** - 数据库中没有用户或密码不匹配

## 诊断步骤

### 1. 检查服务状态

```powershell
# 检查所有服务是否运行
docker-compose ps

# 检查后端日志
docker-compose logs backend-node --tail 50

# 检查前端日志
docker-compose logs frontend-vue --tail 50
```

### 2. 检查API端点

```powershell
# 测试健康检查端点（需要PowerShell 7+或使用浏览器）
# 在浏览器中访问: http://localhost:3000/api/health

# 或者使用Postman/Insomnia测试
# POST http://localhost:3000/api/auth/login
# Body: {"username":"admin","password":"yourpassword"}
```

### 3. 检查用户是否存在

```powershell
# 查看数据库中的用户
docker-compose exec postgres psql -U postgres -d vulnrisk -c "SELECT username, role FROM users;"
```

### 4. 检查前端网络请求

打开浏览器开发者工具（F12），查看Network标签：
- 查看登录请求的URL
- 查看请求状态码
- 查看响应内容

## 解决方案

### 方案1: 创建或重置用户密码

如果用户不存在或密码错误：

```powershell
# 创建管理员用户
cd backend-node
node scripts/create-admin.js admin admin123

# 或重置现有用户密码
node scripts/reset-password.js admin newpassword123
```

### 方案2: 检查前端代理配置

如果使用Docker，前端通过nginx代理到后端。检查：

1. **nginx配置** (`frontend-vue/nginx.conf`):
   ```nginx
   location /api {
       proxy_pass http://backend-node:3000;
       ...
   }
   ```

2. **前端API配置** (`frontend-vue/src/services/api.ts`):
   ```typescript
   const api = axios.create({
     baseURL: '/api',  // 使用相对路径
     ...
   })
   ```

### 方案3: 检查后端路由

确认后端路由正确注册：

```typescript
// backend-node/src/app.ts
app.use('/api/auth', authRoutes);
```

### 方案4: 直接访问后端API测试

如果前端代理有问题，可以直接访问后端：

1. **在浏览器中测试**:
   - 打开: http://localhost:3000/api/health
   - 应该返回: `{"status":"ok","timestamp":"..."}`

2. **使用Postman/curl测试登录**:
   ```
   POST http://localhost:3000/api/auth/login
   Content-Type: application/json
   
   {
     "username": "admin",
     "password": "admin123"
   }
   ```

## 常见错误和解决方法

### 错误1: 404 Not Found

**可能原因**:
- 后端服务未运行
- API路由未正确注册
- 前端代理配置错误

**解决方法**:
```powershell
# 重启后端服务
docker-compose restart backend-node

# 检查后端日志
docker-compose logs backend-node
```

### 错误2: 401 Unauthorized

**可能原因**:
- 用户名或密码错误
- 用户不存在

**解决方法**:
```powershell
# 重置密码
cd backend-node
node scripts/reset-password.js <username> <new_password>

# 或创建新用户
node scripts/create-admin.js <username> <password>
```

### 错误3: Network Error / CORS Error

**可能原因**:
- 前端和后端不在同一域名
- CORS配置问题

**解决方法**:
检查 `backend-node/src/app.ts` 中的CORS配置：
```typescript
app.use(cors()); // 应该允许所有来源（开发环境）
```

### 错误4: 连接被拒绝

**可能原因**:
- 后端服务未启动
- 端口被占用

**解决方法**:
```powershell
# 检查端口占用
netstat -ano | findstr :3000

# 重启服务
docker-compose restart backend-node
```

## 快速修复步骤

1. **确保所有服务运行**:
   ```powershell
   docker-compose up -d
   ```

2. **创建或重置用户**:
   ```powershell
   cd backend-node
   node scripts/create-admin.js admin admin123
   ```

3. **测试后端API**:
   - 浏览器访问: http://localhost:3000/api/health
   - 应该看到JSON响应

4. **测试前端登录**:
   - 浏览器访问: http://localhost
   - 使用创建的用户名和密码登录

5. **检查浏览器控制台**:
   - 按F12打开开发者工具
   - 查看Console和Network标签
   - 查看是否有错误信息

## 调试技巧

### 查看实时日志

```powershell
# 后端日志
docker-compose logs -f backend-node

# 前端日志
docker-compose logs -f frontend-vue

# 所有服务日志
docker-compose logs -f
```

### 检查数据库连接

```powershell
# 测试数据库连接
docker-compose exec backend-node npx prisma db pull
```

### 验证环境变量

```powershell
# 检查后端环境变量
docker-compose exec backend-node env | grep DATABASE
```

## 如果问题仍然存在

1. **完全重启所有服务**:
   ```powershell
   docker-compose down
   docker-compose up -d
   ```

2. **检查防火墙设置**:
   - 确保3000端口（后端）和80端口（前端）未被阻止

3. **检查Docker网络**:
   ```powershell
   docker network ls
   docker network inspect project_default
   ```

4. **查看详细错误信息**:
   - 浏览器开发者工具 > Network > 查看失败的请求
   - 查看Response标签中的错误信息





