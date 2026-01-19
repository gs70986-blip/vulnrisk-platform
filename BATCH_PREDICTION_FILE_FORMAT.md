# 批量预测文件格式说明

## 支持的文件格式

批量预测功能现在支持以下文件格式：

1. **JSON** (`.json`)
2. **CSV** (`.csv`)
3. **Excel** (`.xlsx`, `.xls`)

## 必需字段

每个数据行必须包含以下字段：

- **sample_id** (或 `id`, `sampleId`, `Sample ID`) - 样本ID
- **text_description** (或 `description`, `textDescription`, `Text Description`) - 漏洞描述文本

## 可选字段

- **cvss_base_score** (或 `cvss`, `cvssBaseScore`, `CVSS Base Score`) - CVSS基础分数 (0-10)

## 文件格式示例

### JSON 格式

**格式1: 对象数组**
```json
[
  {
    "sample_id": "CVE-2024-0001",
    "text_description": "A buffer overflow vulnerability exists...",
    "cvss_base_score": 9.8
  },
  {
    "sample_id": "CVE-2024-0002",
    "text_description": "Cross-site scripting (XSS) vulnerability...",
    "cvss_base_score": 6.1
  }
]
```

**格式2: 包含samples字段**
```json
{
  "samples": [
    {
      "sample_id": "CVE-2024-0001",
      "text_description": "A buffer overflow vulnerability exists...",
      "cvss_base_score": 9.8
    }
  ]
}
```

### CSV 格式

```csv
sample_id,text_description,cvss_base_score
CVE-2024-0001,"A buffer overflow vulnerability exists in the authentication module that allows remote attackers to execute arbitrary code via a crafted request.",9.8
CVE-2024-0002,"Cross-site scripting (XSS) vulnerability in the user input validation allows attackers to inject malicious scripts.",6.1
CVE-2024-0003,"SQL injection vulnerability in the database query function allows unauthorized access to sensitive data.",8.5
```

**注意**: CSV文件的第一行应该是列标题。

### Excel 格式

Excel文件应该包含以下列：

| sample_id | text_description | cvss_base_score |
|-----------|------------------|-----------------|
| CVE-2024-0001 | A buffer overflow vulnerability exists... | 9.8 |
| CVE-2024-0002 | Cross-site scripting (XSS) vulnerability... | 6.1 |

**注意**: 
- Excel文件的第一行应该是列标题
- 系统会自动读取第一个工作表
- 列名不区分大小写，支持多种命名方式

## 字段名称映射

系统支持以下字段名称变体（不区分大小写）：

### sample_id 字段
- `sample_id`
- `sampleId`
- `Sample ID`
- `sample ID`
- `id`
- `ID`

### text_description 字段
- `text_description`
- `textDescription`
- `Text Description`
- `text description`
- `description`
- `Description`

### cvss_base_score 字段
- `cvss_base_score`
- `cvssBaseScore`
- `CVSS Base Score`
- `cvss base score`
- `cvss`

## 使用步骤

1. 准备数据文件（JSON、CSV或Excel格式）
2. 确保文件包含必需的字段
3. 在前端页面点击 "Batch Import" 按钮
4. 上传文件
5. 点击 "Start Batch Prediction" 开始预测
6. 等待预测完成，结果会自动保存到数据库

## 示例文件

项目根目录包含以下示例文件：

- `frontend-vue/public/batch_prediction_example.json` - JSON格式示例
- `frontend-vue/public/batch_prediction_example.csv` - CSV格式示例

## 注意事项

1. **文件大小限制**: 最大100MB
2. **数据验证**: 系统会自动过滤无效的数据行（缺少必需字段的行）
3. **编码**: CSV和Excel文件建议使用UTF-8编码
4. **特殊字符**: CSV文件中的文本字段如果包含逗号，请使用双引号括起来
5. **空值处理**: `cvss_base_score` 字段可以为空，系统会自动处理

## 错误处理

如果文件格式不正确或缺少必需字段，系统会返回错误信息：

- `No valid samples found` - 文件中没有有效的数据行
- `Invalid file format` - 不支持的文件格式
- `Failed to parse file` - 文件解析失败

## 常见问题

### Q: CSV文件中的中文显示乱码？
A: 请确保CSV文件使用UTF-8编码保存。

### Q: Excel文件上传后没有数据？
A: 请确保Excel文件的第一行是列标题，且包含必需的字段。

### Q: 可以上传多个文件吗？
A: 目前每次只能上传一个文件。如需处理多个文件，请分别上传。

### Q: 预测需要多长时间？
A: 预测时间取决于数据量。系统设置了5分钟的超时限制。对于大量数据，建议分批处理。









