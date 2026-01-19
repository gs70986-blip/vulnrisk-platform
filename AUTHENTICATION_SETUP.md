# 用户认证功能设置指南

## 概述

系统已实现完整的用户注册登录功能，支持基于角色的访问控制（RBAC）：
- **管理员（admin）**：可以访问所有页面（Datasets, Models, Predictions）
- **普通用户（user）**：只能访问 Models 和 Predictions 页面

## 数据库迁移

### 1. 运行 Prisma 迁移

在 `backend-node` 目录下运行：

```bash
# 生成 Prisma Client
npx prisma generate

# 创建并应用迁移
npx prisma migrate dev --name add_user_model
```

### 2. 验证迁移

迁移成功后，数据库中将新增 `users` 表，包含以下字段：
- `id` (UUID)
- `username` (String, unique)
- `email` (String, nullable, unique)
- `password` (String, hashed)
- `role` (String, default: 'user')
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

## 创建第一个管理员用户

### 方法 1: 通过注册页面（推荐）

1. 启动前端和后端服务
2. 访问登录页面（`http://localhost:5173/login`）
3. 切换到 "Register" 标签
4. 注册一个新用户（默认角色为 `user`）
5. 使用数据库工具或 Prisma Studio 将用户角色改为 `admin`

### 方法 2: 使用 Prisma Studio

```bash
cd backend-node
npx prisma studio
```

在 Prisma Studio 中：
1. 打开 `users` 表
2. 创建新用户或编辑现有用户
3. 将 `role` 字段设置为 `admin`

### 方法 3: 使用 SQL 直接插入

```sql
-- 注意：密码需要使用 bcrypt 加密
-- 这里提供一个示例，实际使用时需要先加密密码
INSERT INTO users (id, username, email, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin',
  'admin@example.com',
  '$2b$10$...', -- 使用 bcrypt 加密的密码
  'admin',
  NOW(),
  NOW()
);
```

### 方法 4: 创建初始化脚本

创建一个脚本 `backend-node/scripts/create-admin.js`：

```javascript
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const email = process.argv[4] || 'admin@example.com';

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'admin',
      },
    });

    console.log('Admin user created successfully:');
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
  } catch (error) {
    if (error.code === 'P2002') {
      console.error('User already exists');
    } else {
      console.error('Error creating admin:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
```

运行脚本：
```bash
cd backend-node
node scripts/create-admin.js [username] [password] [email]
```

## 环境变量配置

确保 `backend-node/.env` 文件中包含 JWT 配置：

```env
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

**重要**：在生产环境中，请使用强随机字符串作为 `JWT_SECRET`。

## API 端点

### 注册
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",  // 可选
  "password": "password123"
}
```

### 登录
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "user123",
  "password": "password123"
}

响应:
{
  "user": {
    "id": "...",
    "username": "user123",
    "email": "user@example.com",
    "role": "user"
  },
  "token": "jwt-token-here"
}
```

### 获取当前用户
```
GET /api/auth/me
Authorization: Bearer <token>

响应:
{
  "user": {
    "id": "...",
    "username": "user123",
    "email": "user@example.com",
    "role": "user"
  }
}
```

## 前端使用

### 登录流程

1. 用户访问任何需要认证的页面时，如果未登录，会自动重定向到 `/login`
2. 在登录页面，用户可以：
   - 使用现有账号登录
   - 注册新账号（默认角色为 `user`）
3. 登录成功后，根据用户角色重定向：
   - 管理员 → `/datasets`
   - 普通用户 → `/models`

### 权限控制

- **Datasets 页面**：仅管理员可见和访问
- **Models 页面**：所有已登录用户可访问
- **Predictions 页面**：所有已登录用户可访问

### 用户信息显示

登录后，页面右上角显示：
- 用户名
- 角色标签（Admin/User）
- 下拉菜单（包含邮箱和登出选项）

## 安全注意事项

1. **密码加密**：所有密码使用 bcrypt 加密存储（10 rounds）
2. **JWT Token**：存储在 localStorage，7 天有效期
3. **Token 验证**：所有需要认证的 API 请求都会验证 JWT token
4. **自动登出**：Token 过期或无效时，自动清除并重定向到登录页
5. **密码要求**：注册时密码至少 6 个字符

## 故障排除

### 问题 1: 迁移失败

**错误**：`Migration failed`

**解决**：
```bash
# 重置数据库（注意：会删除所有数据）
npx prisma migrate reset

# 重新运行迁移
npx prisma migrate dev
```

### 问题 2: 无法登录

**检查**：
1. 确认数据库迁移已成功
2. 检查用户是否存在于数据库中
3. 确认密码是否正确
4. 查看后端日志中的错误信息

### 问题 3: Token 无效

**解决**：
1. 清除浏览器 localStorage
2. 重新登录
3. 检查 `JWT_SECRET` 环境变量是否正确设置

### 问题 4: 权限不足

**错误**：`Admin access required`

**解决**：
1. 确认用户角色为 `admin`
2. 重新登录以刷新 token
3. 检查数据库中的用户角色字段

## 测试

### 测试注册
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "test123",
    "email": "test@example.com"
  }'
```

### 测试登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "test123"
  }'
```

### 测试获取当前用户
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <your-token>"
```

## 下一步

1. ✅ 运行数据库迁移
2. ✅ 创建第一个管理员用户
3. ✅ 测试登录和注册功能
4. ✅ 验证权限控制是否正常工作

完成以上步骤后，系统即可正常使用用户认证功能！








