# 生产环境部署指南 - 项目答辩演示

本指南将帮助您将 VulnRisk 项目部署到生产环境，用于项目答辩演示。

## ⚠️ 重要提示

**数据恢复脚本执行方式**：
- 推荐从**宿主机**执行 `restore-data.js`（不需要容器内有脚本文件）
- 需要本地安装 Node.js
- 如果遇到容器内脚本找不到的问题，请参考 `QUICK_FIX_SCRIPTS_IN_CONTAINER.md`

## 📋 部署方案

推荐使用 **Docker Compose** 进行部署，这是最简单、最可靠的方式。

## 🚀 快速部署步骤

### 前置要求

- ✅ Docker Desktop 已安装并运行
- ✅ 确保端口 80、3000、5000、5432 未被占用
- ✅ 至少 4GB 可用内存

### 步骤 1: 准备项目文件

确保项目目录包含以下内容：
```
Project/
├── docker-compose.yml
├── backend-node/
├── frontend-vue/
├── ml-service/
├── models/          # 模型文件目录
└── data/            # 数据目录（会自动创建）
```

### 步骤 2: 启动所有服务

在项目根目录执行：

**Windows (PowerShell):**
```powershell
docker-compose up -d
```

**Linux/Mac:**
```bash
docker-compose up -d
```

### 步骤 3: 等待服务启动

等待 30-60 秒让所有服务完全启动，然后检查服务状态：

```bash
docker-compose ps
```

应该看到所有服务状态为 `Up`：
- ✅ vulnrisk-postgres
- ✅ vulnrisk-backend
- ✅ vulnrisk-ml
- ✅ vulnrisk-frontend

### 步骤 4: 初始化数据库

```bash
docker-compose exec backend-node npx prisma migrate deploy
```

### 步骤 5: 恢复基础数据

创建管理员用户并注册模型：

**推荐方法: 从宿主机执行（最简单可靠）**
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

**注意**: 
- 需要本地安装 Node.js
- 脚本会连接到 Docker 容器内的数据库
- 如果遇到连接问题，确保数据库容器正在运行

这将：
- ✅ 创建默认管理员用户（admin/admin123）
- ✅ 自动注册可用的模型文件
- ✅ 显示数据库状态

### 步骤 6: 激活模型（重要）

模型默认未激活，需要激活后才能使用：

**方法 1: 通过前端界面激活（推荐）**
1. 访问 http://localhost
2. 登录（admin/admin123）
3. 进入 "Models" 页面
4. 点击模型右侧的 "Activate" 按钮

**方法 2: 使用命令行激活（从宿主机执行）**
```bash
cd backend-node
node scripts/register-model.js ../models/risk_model_001 risk_model_001 --activate
cd ..
```

**方法 3: 在容器内执行（如果脚本存在）**
```bash
docker-compose exec backend-node node /app/scripts/register-model.js /app/models/risk_model_001 risk_model_001 --activate
```

**或者通过前端界面激活：**
1. 访问 http://localhost
2. 登录（admin/admin123）
3. 进入 "Models" 页面
4. 点击模型右侧的 "Activate" 按钮

### 步骤 7: 验证部署

访问以下地址验证服务是否正常：

- **前端界面**: http://localhost
- **后端 API**: http://localhost:3000/api/health
- **ML 服务**: http://localhost:5000/health

## 📝 演示前准备清单

### ✅ 功能测试

1. **登录测试**
   - 用户名: `admin`
   - 密码: `admin123`
   - 确认可以正常登录

2. **模型激活**
   - 确认至少有一个模型已激活
   - 在 Models 页面查看模型状态

3. **预测功能测试**
   - 测试单次预测
   - 测试批量预测
   - 测试 GitHub 文本抓取

4. **数据展示**
   - 查看预测历史
   - 确认表格显示正常
   - 确认 N/A 风险等级的 explanation 显示正常

### ✅ 演示数据准备

准备一些测试数据用于演示：

**单次预测示例：**
```json
{
  "sample_id": "demo_001",
  "text_description": "SQL injection vulnerability in login form allows unauthorized access to user accounts",
  "cvss_base_score": 7.5
}
```

**批量预测示例（CSV）：**
```csv
sample_id,text_description,cvss_base_score
demo_001,SQL injection vulnerability in login form,7.5
demo_002,XSS vulnerability in comment section allows script execution,6.1
demo_003,Authentication bypass vulnerability,8.2
```

**GitHub 链接示例：**
- Issue: `https://github.com/owner/repo/issues/123`
- PR: `https://github.com/owner/repo/pull/456`
- Commit: `https://github.com/owner/repo/commit/abc123def456`

### ✅ 演示流程建议

1. **系统介绍** (1-2分钟)
   - 展示系统架构
   - 介绍主要功能模块

2. **数据集管理** (2-3分钟)
   - 上传数据集
   - 展示数据预处理

3. **模型训练** (可选，3-5分钟)
   - 训练新模型
   - 展示训练结果

4. **风险预测** (5-7分钟)
   - 单次预测演示
   - GitHub 文本抓取演示
   - 批量预测演示
   - 展示 N/A 风险等级的 explanation

5. **结果分析** (2-3分钟)
   - 查看预测历史
   - 展示风险评分和等级
   - 展示可视化图表

## 🔧 常见问题处理

### 问题 1: 端口被占用

**错误信息：** `port is already allocated`

**解决方案：**
```bash
# 检查端口占用
netstat -ano | findstr :80
netstat -ano | findstr :3000

# 修改 docker-compose.yml 中的端口映射
# 例如将 80 改为 8080
ports:
  - "8080:80"
```

### 问题 2: 数据库连接失败

**错误信息：** `Can't reach database server`

**解决方案：**
```bash
# 检查 PostgreSQL 容器状态
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 重启数据库
docker-compose restart postgres
```

### 问题 3: 前端无法访问后端

**错误信息：** `Network Error` 或 `CORS Error`

**解决方案：**
1. 检查 `frontend-vue/nginx.conf` 配置
2. 确认后端服务正常运行：`docker-compose logs backend-node`
3. 检查环境变量是否正确

### 问题 4: 模型文件找不到

**错误信息：** `Model file not found`

**解决方案：**
```bash
# 检查模型文件是否存在
ls -la models/

# 确认 docker-compose.yml 中的 volumes 配置正确
volumes:
  - ./models:/app/models
```

### 问题 5: 服务启动失败

**解决方案：**
```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs backend-node
docker-compose logs ml-service
docker-compose logs frontend-vue

# 重新构建并启动
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📊 演示环境优化建议

### 性能优化

1. **限制资源使用**（可选）
   在 `docker-compose.yml` 中添加资源限制：
   ```yaml
   services:
     backend-node:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
   ```

2. **预热服务**
   在演示前 10 分钟启动服务，让系统预热

### 数据准备

1. **预加载演示数据**
   - 提前运行一些预测，生成历史数据
   - 准备一些有代表性的预测结果

2. **准备备用方案**
   - 准备离线演示截图
   - 准备演示视频（备用）

## 🔐 安全建议（演示环境）

### 生产环境注意事项

如果用于真实生产环境，请修改：

1. **数据库密码**
   ```yaml
   # docker-compose.yml
   environment:
     POSTGRES_PASSWORD: your_strong_password_here
   ```

2. **管理员密码**
   ```bash
   # 登录后立即修改
   # 或使用 reset-password.js 脚本
   docker-compose exec backend-node node scripts/reset-password.js admin new_password
   ```

3. **JWT Secret**
   在 `backend-node/.env` 中设置强密钥：
   ```env
   JWT_SECRET=your_very_strong_secret_key_here
   ```

## 📱 访问地址

部署成功后，可以通过以下地址访问：

- **前端界面**: http://localhost (或 http://your-server-ip)
- **后端 API**: http://localhost:3000
- **API 文档**: http://localhost:3000/api/health
- **ML 服务**: http://localhost:5000/health

## 🎯 演示检查清单

演示前最后检查：

- [ ] 所有服务正常运行（`docker-compose ps`）
- [ ] 可以访问前端界面
- [ ] 可以正常登录
- [ ] 至少有一个模型已激活
- [ ] 可以正常进行预测
- [ ] 预测结果正确显示
- [ ] N/A 风险等级的 explanation 正常显示
- [ ] 网络连接稳定
- [ ] 浏览器缓存已清除（Ctrl+F5）

## 🆘 紧急恢复

如果演示过程中出现问题：

1. **快速重启服务**
   ```bash
   docker-compose restart
   ```

2. **查看实时日志**
   ```bash
   docker-compose logs -f
   ```

3. **重置数据库**（最后手段）
   ```bash
   docker-compose down -v  # 删除所有数据
   docker-compose up -d
   docker-compose exec backend-node npx prisma migrate deploy
   docker-compose exec backend-node node scripts/restore-data.js
   ```

## 📞 技术支持

如果遇到问题，可以：

1. 查看服务日志：`docker-compose logs [service-name]`
2. 检查服务状态：`docker-compose ps`
3. 查看本文档的"常见问题处理"部分

---

**祝答辩顺利！** 🎉

