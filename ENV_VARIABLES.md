# 环境变量配置说明

本文档列出了 VulnRisk 项目所有服务所需的环境变量。

## 后端服务 (backend-node)

### 必需变量
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
  - 示例: `postgresql://user:password@localhost:5432/vulnrisk`

### 可选变量（有默认值）
- `PORT`: 服务端口（默认: 3000）
- `ML_SERVICE_URL`: ML 服务地址（默认: http://localhost:5000）
- `NODE_ENV`: 运行环境（development/production，默认: development）
- `JWT_SECRET`: JWT 密钥（默认: 'your-secret-key-change-in-production'）
- `JWT_EXPIRES_IN`: JWT 过期时间（默认: '7d'）
- `UPLOAD_DIR`: 文件上传目录（默认: './uploads'）

### 功能开关
- `AUTO_APPEND_TRAINING_DATA`: 是否自动将预测输入追加到训练数据集（默认: false）
  - 设置为 `true` 时启用自动追加
  - **警告**: 启用此功能可能导致反馈循环污染，特别是当预测包含非漏洞相关文本时
  - 即使启用，系统也会过滤掉 riskLevel 为 "N/A" 或 "Uncertain" 的样本

- `GITHUB_TOKEN`: GitHub Personal Access Token（可选）
  - 强烈推荐设置，以避免 GitHub API 速率限制
  - 不设置 token 时仍可使用，但可能受到 GitHub API 速率限制

## ML 服务 (ml-service)

### 可选变量（有默认值）
- `PORT`: 服务端口（默认: 5000）
- `MODELS_DIR`: 模型存储目录（默认: /app/models）
- `DATA_DIR`: 数据集存储目录（默认: /app/data）
- `RISK_ALPHA`: 风险评分权重（默认: 0.6）

### CVSS 估算相关
- `CVSS_SIM_THRESHOLD`: CVSS 相似度阈值（默认: 0.18）
  - 当输入文本与训练数据的最大相似度低于此值时，不估算 CVSS
  - 较低的值允许更多文本进行 CVSS 估算，但可能产生不准确的估算
  - 较高的值更保守，只对高相似度文本进行估算

### 不确定性判断相关
- `PVULN_UNCERTAIN_LOW`: 漏洞概率不确定区间下限（默认: 0.35）
  - 当 p_vuln 在此值和上限之间，且无 CVSS 时，输出 "Uncertain"

- `PVULN_UNCERTAIN_HIGH`: 漏洞概率不确定区间上限（默认: 0.65）
  - 当 p_vuln 在此值和下限之间，且无 CVSS 时，输出 "Uncertain"

- `MIN_TEXT_LENGTH`: 最小文本长度（默认: 20）
  - 输入文本长度低于此值时，输出 "N/A"

## 环境变量示例

### backend-node/.env
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vulnrisk
PORT=3000
ML_SERVICE_URL=http://localhost:5000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# 功能开关
AUTO_APPEND_TRAINING_DATA=false

# GitHub API（可选）
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### ml-service/.env
```env
PORT=5000
MODELS_DIR=/app/models
DATA_DIR=/app/data
RISK_ALPHA=0.6

# CVSS 估算阈值
CVSS_SIM_THRESHOLD=0.18

# 不确定性判断
PVULN_UNCERTAIN_LOW=0.35
PVULN_UNCERTAIN_HIGH=0.65
MIN_TEXT_LENGTH=20
```

## 测试用例

以下是最小测试用例，用于验证拒答机制（N/A/Uncertain）是否正常工作：

### 1. 空文本 → N/A
```json
{
  "sample_id": "test_empty",
  "text_description": "",
  "cvss_base_score": null
}
```
**预期结果**: `riskLevel="N/A"`, `explanation` 包含 "文本过短"

### 2. 普通文本（低相似度）→ N/A
```json
{
  "sample_id": "test_normal",
  "text_description": "今天更新了 README 文件，重构了代码结构",
  "cvss_base_score": null
}
```
**预期结果**: 如果 `max_similarity < CVSS_SIM_THRESHOLD`，则 `riskLevel="N/A"`, `explanation` 包含 "相似度低"

### 3. 普通文本但 p_vuln 在不确定区间 → Uncertain
```json
{
  "sample_id": "test_uncertain",
  "text_description": "some ambiguous text that triggers p_vuln in [0.35, 0.65]",
  "cvss_base_score": null
}
```
**预期结果**: 如果 `PVULN_UNCERTAIN_LOW <= p_vuln <= PVULN_UNCERTAIN_HIGH`，则 `riskLevel="Uncertain"`, `explanation` 包含 "不确定区间"

### 4. 明显漏洞文本 → 正常输出
```json
{
  "sample_id": "test_vuln",
  "text_description": "SQL injection vulnerability in login form allows unauthorized access",
  "cvss_base_score": 7.5
}
```
**预期结果**: 正常输出 `riskLevel`（Low/Medium/High/Critical）

## 注意事项

1. **AUTO_APPEND_TRAINING_DATA**: 
   - 默认关闭（false）以防止反馈循环污染
   - 即使启用，系统也会自动过滤不合适的样本（N/A、Uncertain、低相似度等）
   - 建议在生产环境中谨慎使用

2. **CVSS_SIM_THRESHOLD**:
   - 默认值 0.18 经过测试，平衡了准确性和覆盖率
   - 可以根据实际数据分布调整
   - 过低可能导致无关文本被估算为高 CVSS
   - 过高可能导致太多文本无法进行风险评估

3. **PVULN_UNCERTAIN_***:
   - 这些阈值定义了模型的"不确定区间"
   - 在此区间内，模型难以明确判断是否为漏洞
   - 可以基于模型的置信度分布进行调整

4. **MIN_TEXT_LENGTH**:
   - 过短的文本可能无法提供足够的上下文进行准确预测
   - 默认 20 字符是一个合理的阈值
   - 可以根据实际需求调整



