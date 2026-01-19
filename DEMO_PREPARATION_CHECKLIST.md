# 项目答辩演示准备清单

## 📋 部署前检查

### 环境准备
- [ ] Docker Desktop 已安装并运行
- [ ] 端口 80、3000、5000、5432 未被占用
- [ ] 至少 4GB 可用内存
- [ ] 网络连接正常

### 文件准备
- [ ] `docker-compose.yml` 存在
- [ ] `backend-node/` 目录完整
- [ ] `frontend-vue/` 目录完整
- [ ] `ml-service/` 目录完整
- [ ] `models/` 目录包含模型文件
- [ ] `backend-node/scripts/restore-data.js` 存在

## 🚀 部署步骤

### 1. 执行部署脚本

**Windows:**
```powershell
.\deploy-production.bat
```

**Linux/Mac:**
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

### 2. 验证服务状态

```bash
docker-compose ps
```

所有服务应显示为 `Up` 状态。

### 3. 检查服务健康

- [ ] 前端: http://localhost (应显示登录页面)
- [ ] 后端: http://localhost:3000/api/health (应返回健康状态)
- [ ] ML服务: http://localhost:5000/health (应返回健康状态)

## 🔐 初始化数据

### 1. 创建管理员用户

如果 `restore-data.js` 已运行，用户应已创建。

验证：
```bash
docker-compose exec backend-node node scripts/create-admin.js admin admin123 admin@example.com
```

### 2. 注册并激活模型

```bash
# 查看可用模型
ls models/

# 注册并激活模型
docker-compose exec backend-node node scripts/register-model.js /app/models/risk_model_001 risk_model_001 --activate
```

或通过前端界面：
- [ ] 登录系统 (admin/admin123)
- [ ] 进入 Models 页面
- [ ] 激活一个模型

## ✅ 功能测试

### 登录测试
- [ ] 可以正常登录
- [ ] 登录后可以访问所有页面

### 数据集管理
- [ ] 可以上传数据集
- [ ] 可以查看数据集列表
- [ ] 可以预处理数据集

### 模型管理
- [ ] 可以查看模型列表
- [ ] 至少有一个模型已激活
- [ ] 可以查看模型详情

### 预测功能
- [ ] **单次预测**
  - [ ] 可以输入样本进行预测
  - [ ] 预测结果正确显示
  - [ ] 风险等级正确显示
  - [ ] N/A 风险等级的 explanation 正常显示

- [ ] **批量预测**
  - [ ] 可以上传 CSV/JSON 文件
  - [ ] 批量预测结果正确显示
  - [ ] 可以导出结果

- [ ] **GitHub 文本抓取**
  - [ ] 可以抓取 Issue 文本
  - [ ] 可以抓取 PR 文本
  - [ ] 可以抓取 Commit 文本
  - [ ] 抓取后可以自动填充预测表单

### 预测历史
- [ ] 可以查看预测历史列表
- [ ] 表格显示正常
- [ ] Text Description 列显示正常
- [ ] N/A 风险等级的 explanation tooltip 正常显示
- [ ] 分页功能正常

## 📊 演示数据准备

### 测试用例 1: 正常漏洞描述
```json
{
  "sample_id": "demo_vuln_001",
  "text_description": "SQL injection vulnerability in login form allows unauthorized access to user accounts. The application does not properly sanitize user input, enabling attackers to execute arbitrary SQL commands.",
  "cvss_base_score": 7.5
}
```
**预期结果**: High 或 Critical 风险等级

### 测试用例 2: 无关文本（应返回 N/A）
```json
{
  "sample_id": "demo_normal_001",
  "text_description": "today is a good day, i am very happy"
}
```
**预期结果**: 
- riskLevel: "N/A"
- pVuln: 0
- riskScore: 0
- explanation: 显示说明

### 测试用例 3: 普通代码更新（可能返回 Low 或 N/A）
```json
{
  "sample_id": "demo_code_001",
  "text_description": "refactor code and update README, fix typos, improve CI pipeline"
}
```
**预期结果**: Low 或 N/A（取决于相似度）

### GitHub 链接测试
- [ ] 准备一个真实的 GitHub Issue/PR/Commit 链接
- [ ] 测试抓取功能
- [ ] 验证抓取结果

## 🎯 演示流程建议

### 1. 系统介绍 (2分钟)
- [ ] 展示系统架构图
- [ ] 介绍技术栈
- [ ] 介绍主要功能模块

### 2. 数据集管理 (2-3分钟)
- [ ] 上传演示数据集
- [ ] 展示数据预处理功能
- [ ] 说明数据格式要求

### 3. 模型训练 (可选，3-5分钟)
- [ ] 展示模型训练流程
- [ ] 展示训练结果和指标
- [ ] 说明模型选择依据

### 4. 风险预测核心功能 (5-7分钟)
- [ ] **单次预测**
  - 输入漏洞描述
  - 展示预测结果
  - 解释风险评分和等级

- [ ] **GitHub 文本抓取**
  - 演示抓取 GitHub Issue
  - 展示自动填充功能
  - 进行预测

- [ ] **批量预测**
  - 上传批量数据文件
  - 展示批量预测结果
  - 导出结果

- [ ] **工程裁剪功能**
  - 输入无关文本（如 "today is a good day"）
  - 展示 N/A 风险等级
  - 展示 explanation tooltip
  - 说明为什么返回 N/A

### 5. 结果分析 (2-3分钟)
- [ ] 查看预测历史
- [ ] 展示不同风险等级的分布
- [ ] 展示可视化图表（如果有）
- [ ] 说明如何解读结果

### 6. 总结 (1-2分钟)
- [ ] 系统优势
- [ ] 技术亮点
- [ ] 应用场景

## 🔧 演示前最后检查

### 技术检查
- [ ] 所有服务正常运行
- [ ] 网络连接稳定
- [ ] 浏览器缓存已清除（Ctrl+F5）
- [ ] 准备备用浏览器（Chrome、Edge）
- [ ] 准备离线演示截图（备用）

### 数据检查
- [ ] 至少有一个模型已激活
- [ ] 准备了一些预测历史数据
- [ ] 测试数据文件已准备好
- [ ] GitHub 链接已准备好

### 环境检查
- [ ] 演示电脑已连接电源
- [ ] 网络连接稳定
- [ ] 投影设备已连接并测试
- [ ] 屏幕分辨率已调整

## 🆘 应急方案

### 如果服务崩溃
```bash
# 快速重启
docker-compose restart

# 查看日志
docker-compose logs -f
```

### 如果网络问题
- 准备离线演示截图
- 准备演示视频
- 准备 PPT 备用方案

### 如果数据库问题
```bash
# 重置数据库（最后手段）
docker-compose down -v
docker-compose up -d
docker-compose exec backend-node npx prisma migrate deploy
docker-compose exec backend-node node scripts/restore-data.js
```

## 📝 演示要点

### 技术亮点
1. **工程裁剪（Business Clipping）**
   - 展示 N/A 风险等级
   - 说明如何避免误报
   - 展示 explanation 功能

2. **GitHub 集成**
   - 展示文本抓取功能
   - 说明实际应用场景

3. **批量处理**
   - 展示批量预测能力
   - 说明效率提升

4. **风险评分算法**
   - 说明 CVSS 和 P(vuln) 的融合
   - 展示相似度估算

### 业务价值
1. **自动化风险评估**
2. **提高安全团队效率**
3. **减少人工误判**
4. **支持大规模漏洞分析**

---

**祝答辩顺利！** 🎉

