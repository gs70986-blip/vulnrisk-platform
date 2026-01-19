# 部署与更新指南（本地 → GitHub → 云服务器）

本文档描述了 VulnRisk 项目的**标准部署与更新流程**，用于将本地开发的代码、模型和数据，安全、可控地同步到 **阿里云 ECS 云服务器**。

本流程已在真实云服务器环境中验证，可直接用于答辩和长期维护。

---

## 1. 项目结构与职责划分（非常重要）

本项目**刻意将“代码”和“运行时资产”分离**，这是标准工程实践。

### 1.1 由 Git 管理的内容（代码）

以下内容 **会提交到 GitHub**，通过 `git pull` 同步：

- backend-node/（后端代码）
- frontend-vue/（前端代码）
- ml-service/（仅源代码，不含大数据）
- docker-compose.yml
- scripts/
- README.md / 文档

---

### 1.2 不由 Git 管理的内容（运行时资产）

以下内容 **不会提交到 GitHub**，而是手动同步：

- `.env`（token、数据库密码等）
- `models/`（训练好的模型文件）
- 大型数据文件（如 `merged_json_table.csv`）
- `node_modules/`
- 上传文件、日志、数据库数据等

这些内容已在 `.gitignore` 中明确忽略。

---

## 2. 一次性初始化（你已经完成）

- 项目代码已推送至 GitHub（干净历史，无大文件）
- 云服务器 `/root/Project` 使用 GitHub clone
- `.env`、models、数据文件已手动放置
- Docker + docker-compose 已安装

---

## 3. 日常更新的核心思想（牢记）

项目更新分为 **两条独立通道**：

| 变更内容 | 使用方式 |
|--------|--------|
| 代码变更 | GitHub（git push / git pull） |
| 模型 / CSV / .env | scp / rsync 手动同步 |

👉 **Git 永远不会更新被 `.gitignore` 忽略的内容**

---

## 4. 更新代码（本地 → GitHub → 云服务器）

### 4.1 本地：提交并推送代码

```bash
git add .
git commit -m "update: 描述修改内容"
git push
```

⚠️ 确保未提交：
- `.env`
- models
- 大 CSV
- node_modules

---

### 4.2 云服务器：拉取并重建

```bash
cd /root/Project
git pull
docker-compose up -d --build
```

这一步保证：
- 云服务器代码 == GitHub 最新代码
- 容器基于最新源码重建

---

## 5. 更新模型 / 数据（Git 不负责）

Git 不会同步这些内容，**必须手动传输**。

---

### 5.1 同步模型目录（推荐）

在 **本地电脑** 执行：

```bash
scp -r ~/Desktop/Project/models root@<服务器IP>:/root/Project/models
```

或使用 rsync（更快）：

```bash
rsync -avz ~/Desktop/Project/models/ root@<服务器IP>:/root/Project/models/
```

---

### 5.2 同步大型 CSV 数据（示例）

```bash
scp ~/Desktop/Project/ml-service/merged_json_table.csv \
    root@<服务器IP>:/root/Project/ml-service/
```

---

### 5.3 同步 `.env`（谨慎）

⚠️ 只有当你确认 **本地 `.env` 是最新版本** 时才执行：

```bash
scp ~/Desktop/Project/.env root@<服务器IP>:/root/Project/.env
```

---

## 6. 让服务加载新资产（非常重要）

同步模型或数据后，**必须重启服务**。

### 6.1 重启 ML 服务

```bash
cd /root/Project
docker-compose restart ml-service
```

---

### 6.2 如果模型列表/元数据变化，重启后端

```bash
docker-compose restart backend-node
```

---

## 7. 新模型注册流程（必须步骤）

如果你：
- 新增了模型目录
- 或修改了模型元数据

就必须注册模型。

### 7.1 注册模型命令

```bash
docker-compose exec backend-node \
  sh -lc "node scripts/register-model.js /models/<模型目录> <模型ID> --activate"
```

示例：

```bash
docker-compose exec backend-node \
  sh -lc "node scripts/register-model.js /models/risk_model_002_smote risk_model_002_smote --activate"
```

---

### 7.2 验证注册是否成功

```bash
curl http://127.0.0.1:3000/api/models
```

返回非空 JSON 即成功。

---

## 8. 云服务器一键部署脚本（强烈推荐）

在云服务器创建：

```bash
/root/deploy.sh
```

内容如下：

```bash
#!/usr/bin/env bash
set -e
cd /root/Project
git pull
docker-compose up -d --build
docker-compose ps
```

赋予执行权限：

```bash
chmod +x /root/deploy.sh
```

以后只需运行：

```bash
/root/deploy.sh
```

---

## 9. 如何打开云服务器终端（SSH 登录）

在进行代码部署、模型同步或服务重启前，首先需要登录云服务器终端。

### 9.1 方式一：通过阿里云控制台（适合新手）

1. 登录阿里云控制台：https://ecs.console.aliyun.com
2. 选择地域（如：新加坡）
3. 点击你的 ECS 实例
4. 点击 **远程连接** → **通过 VNC / Workbench 连接**
5. 选择 **Workbench（推荐）**
6. 使用 `root` 用户登录

该方式无需本地配置 SSH，适合首次使用或临时操作。

---

### 9.2 方式二：通过本地终端 SSH（推荐，最常用）

在你的本地电脑终端中执行（Windows 可用 PowerShell / Git Bash）：

```bash
ssh root@<云服务器公网IP>
```

- `<云服务器公网IP>`：在 ECS 实例详情页中可查看
- 首次连接会提示是否信任主机，输入 `yes`
- 然后输入 root 密码

登录成功后，你将看到类似提示：

```text
root@instance-name:~#
```

此时即可执行部署相关命令，例如：

```bash
cd /root/Project
/root/deploy.sh
```

---

### 9.3 常见问题

- **无法连接 SSH**：
  - 确认实例状态为“运行中”
  - 确认安全组已放行 22 端口
- **忘记 root 密码**：
  - 可在阿里云控制台重置实例密码

---

## 10. 不用时停止云服务器（省钱）

在阿里云 ECS 控制台：

1. 选择实例
2. 点击 **停止（普通停止）**

效果：
- CPU / 内存不再计费
- 磁盘 / 数据 / 模型全部保留

需要使用时再 **启动实例即可**。

---

## 11. 黄金原则（必须牢记）

- Git **只管理代码**
- `.env / models / 数据` 属于部署资产
- 永远不要把以下内容提交 GitHub：
  - `.env`
  - node_modules
  - 大 CSV / 模型文件
- 更新资产后 **一定要重启服务**
- 不确定时，记住一句话：

> **git pull → docker-compose up -d --build**

---

## 12. 常见场景速查

### 场景 A：只改了代码
```bash
git push
ssh 服务器
/root/deploy.sh
```

---

### 场景 B：新增模型
```bash
scp models/
docker-compose restart ml-service
node register-model.js
```

---

### 场景 C：更新 CSV 数据
```bash
scp merged_json_table.csv
docker-compose restart ml-service
```

---

## 13. 总结说明（可用于答辩）

本项目采用：
- 代码与运行时资产解耦
- Git 管理代码
- 手动同步模型与数据
- Docker Compose 管理服务

该设计保证了：
- 仓库干净
- 部署可控
- 系统可复现
- 云服务器成本可控

hello world