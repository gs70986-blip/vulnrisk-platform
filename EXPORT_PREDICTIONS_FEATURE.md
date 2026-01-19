# 预测结果导出功能说明

## 功能概述

在 Predictions 页面新增了导出预测结果的功能，支持将预测数据导出为 CSV、Excel 或 JSON 格式。

## 功能特性

### 支持的导出格式

1. **CSV 格式** (`.csv`)
   - 适合在 Excel、Google Sheets 等工具中打开
   - 文件小，易于处理
   - 包含所有预测字段

2. **Excel 格式** (`.xlsx`)
   - 原生 Excel 格式
   - 支持格式化和公式
   - 适合复杂数据分析

3. **JSON 格式** (`.json`)
   - 结构化数据格式
   - 适合程序处理
   - 保留完整的数据结构

### 导出的数据字段

每个预测记录包含以下字段：

- **ID**: 预测记录的唯一标识符
- **Sample ID**: 样本ID
- **Text Description**: 漏洞描述文本
- **P(vuln)**: 漏洞概率 (0-1)
- **CVSS**: CVSS基础评分 (0-10)
- **Risk Score**: 风险评分 (0-1)
- **Risk Level**: 风险等级 (Low/Medium/High/Critical)
- **Model Type**: 使用的模型类型 (RandomForest/XGBoost)
- **Created At**: 创建时间

## 使用方法

### 前端操作

1. **访问 Predictions 页面**
   - 登录系统
   - 导航到 Predictions 页面

2. **导出预测结果**
   - 点击页面右上角的 "Export" 按钮
   - 选择导出格式：
     - Export as CSV
     - Export as Excel
     - Export as JSON
   - 文件会自动下载到浏览器默认下载目录

3. **文件命名**
   - 文件名格式: `predictions_YYYY-MM-DDTHH-MM-SS.{extension}`
   - 例如: `predictions_2024-01-15T10-30-45.csv`

### API 调用

#### 导出端点

```
GET /api/predictions/export
```

#### 查询参数

- `format` (必需): 导出格式，可选值: `csv`, `excel`, `json`
- `limit` (可选): 限制导出的记录数
- `offset` (可选): 偏移量，用于分页

#### 示例请求

```bash
# 导出为 CSV
curl -X GET "http://localhost:3000/api/predictions/export?format=csv" \
  -H "Authorization: Bearer <your-token>" \
  --output predictions.csv

# 导出为 Excel
curl -X GET "http://localhost:3000/api/predictions/export?format=excel" \
  -H "Authorization: Bearer <your-token>" \
  --output predictions.xlsx

# 导出为 JSON
curl -X GET "http://localhost:3000/api/predictions/export?format=json" \
  -H "Authorization: Bearer <your-token>" \
  --output predictions.json

# 导出前100条记录
curl -X GET "http://localhost:3000/api/predictions/export?format=csv&limit=100" \
  -H "Authorization: Bearer <your-token>" \
  --output predictions.csv
```

## 实现细节

### 后端实现

#### 1. 服务层 (`backend-node/src/services/prediction.service.ts`)

- `getAllPredictionsForExport()`: 获取所有预测数据用于导出
- `exportToCSV()`: 将数据转换为 CSV 格式
- `exportToExcel()`: 将数据转换为 Excel 格式
- `exportToJSON()`: 将数据转换为 JSON 格式

#### 2. 控制器 (`backend-node/src/controllers/prediction.controller.ts`)

- `exportPredictions()`: 处理导出请求，根据格式返回相应的文件

#### 3. 路由 (`backend-node/src/routes/predictions.ts`)

- `GET /api/predictions/export`: 导出端点

### 前端实现

#### 1. API 服务 (`frontend-vue/src/services/api.ts`)

```typescript
export: async (format: 'csv' | 'excel' | 'json', limit?: number, offset?: number): Promise<Blob>
```

#### 2. Predictions 页面 (`frontend-vue/src/views/Predictions.vue`)

- 导出按钮（下拉菜单）
- `handleExport()` 方法处理导出逻辑
- 自动下载文件

## 数据格式示例

### CSV 格式

```csv
ID,Sample ID,Text Description,P(vuln),CVSS,Risk Score,Risk Level,Model Type,Created At
abc-123,CVE-2024-0001,"SQL injection vulnerability...",0.8500,7.5,0.7800,High,XGBoost,2024-01-15T10:30:45.000Z
```

### JSON 格式

```json
[
  {
    "id": "abc-123",
    "sampleId": "CVE-2024-0001",
    "textDescription": "SQL injection vulnerability...",
    "pVuln": 0.85,
    "cvss": 7.5,
    "riskScore": 0.78,
    "riskLevel": "High",
    "modelType": "XGBoost",
    "createdAt": "2024-01-15T10:30:45.000Z"
  }
]
```

### Excel 格式

Excel 文件包含相同的数据，以表格形式呈现，可以直接在 Excel 中打开和编辑。

## 权限要求

- ✅ 需要用户登录（认证）
- ✅ 所有已登录用户都可以导出预测结果
- ❌ 不需要管理员权限

## 注意事项

1. **数据量限制**
   - 默认导出所有预测记录
   - 可以通过 `limit` 参数限制导出的记录数
   - 大量数据导出可能需要较长时间

2. **文件大小**
   - CSV 和 JSON 文件通常较小
   - Excel 文件可能较大，特别是包含大量数据时

3. **浏览器兼容性**
   - 现代浏览器都支持文件下载
   - 如果下载失败，检查浏览器下载设置

4. **数据准确性**
   - 导出的数据与页面显示的数据一致
   - 时间格式为 ISO 8601 格式

## 故障排除

### 问题 1: 导出按钮不可用

**原因**: 没有预测数据或正在加载

**解决**: 
- 确保有预测记录
- 等待数据加载完成

### 问题 2: 下载失败

**原因**: 
- 网络错误
- 服务器错误
- 浏览器阻止下载

**解决**:
- 检查网络连接
- 查看浏览器控制台错误
- 检查浏览器下载设置
- 查看后端日志

### 问题 3: 文件格式错误

**原因**: 
- 服务器返回错误
- 数据格式问题

**解决**:
- 检查后端日志
- 尝试其他格式
- 联系管理员

## 未来改进

可能的增强功能：

1. **筛选导出**: 根据条件筛选要导出的数据
2. **批量导出**: 支持导出多个模型的结果
3. **定时导出**: 自动定时导出
4. **邮件发送**: 将导出文件发送到邮箱
5. **导出模板**: 自定义导出字段和格式

## 相关文件

- `backend-node/src/services/prediction.service.ts` - 导出服务实现
- `backend-node/src/controllers/prediction.controller.ts` - 导出控制器
- `backend-node/src/routes/predictions.ts` - 导出路由
- `frontend-vue/src/services/api.ts` - 前端 API 服务
- `frontend-vue/src/views/Predictions.vue` - Predictions 页面组件








