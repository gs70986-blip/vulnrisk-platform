# 快速修复：容器内脚本文件问题

## 问题描述

在 Docker 容器中执行 `restore-data.js` 时出现错误：
```
Error: Cannot find module '/app/scripts/restore-data.js'
```

## 解决方案

### 方案 1: 从宿主机执行（推荐，最简单）

如果您的本地机器已安装 Node.js，直接从宿主机执行：

```bash
cd backend-node
node scripts/restore-data.js
cd ..
```

**Windows:**
```powershell
cd backend-node
node scripts/restore-data.js
cd ..
```

### 方案 2: 重新构建容器（确保脚本被包含）

1. **停止并删除容器**
```bash
docker-compose down
```

2. **重新构建容器**
```bash
docker-compose build --no-cache backend-node
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **验证脚本是否存在**
```bash
docker-compose exec backend-node ls -la /app/scripts/
```

### 方案 3: 使用 Volume 映射（已配置）

`docker-compose.yml` 已添加 scripts 目录的映射：
```yaml
volumes:
  - ./backend-node/scripts:/app/scripts:ro
```

重启容器后生效：
```bash
docker-compose restart backend-node
docker-compose exec backend-node node /app/scripts/restore-data.js
```

### 方案 4: 手动复制脚本到容器

```bash
# 复制脚本到运行中的容器
docker cp backend-node/scripts/restore-data.js vulnrisk-backend:/app/scripts/restore-data.js

# 执行脚本
docker-compose exec backend-node node /app/scripts/restore-data.js
```

## 推荐做法

**对于演示环境，推荐使用方案 1（从宿主机执行）**，因为：
- ✅ 最简单，不需要重新构建容器
- ✅ 不需要担心容器内文件路径问题
- ✅ 脚本可以直接访问本地文件系统

## 验证数据恢复

执行脚本后，应该看到：
```
✓ 管理员用户创建成功
✓ 模型注册成功
✓ 数据库状态检查完成
```

然后可以：
1. 访问 http://localhost 登录（admin/admin123）
2. 在 Models 页面激活模型
3. 开始使用系统

