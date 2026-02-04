# API格式使用指南

## 概述

本指南说明如何使用演示数据集进行单个预测和批量预测。

## API格式要求

### 单个预测API

**端点**: `POST /api/predictions`

**请求体格式**:
```json
{
  "sample_id": "string (必需)",
  "text_description": "string (必需)",
  "cvss_base_score": "number (可选)",
  "modelId": "string (可选)"
}
```

### 批量预测API

**端点**: `POST /api/predictions/batch`

**请求体格式**:
```json
{
  "samples": [
    {
      "sample_id": "string (必需)",
      "text_description": "string (必需)",
      "cvss_base_score": "number (可选)"
    }
  ],
  "modelId": "string (可选)"
}
```

### 批量预测文件上传

**端点**: `POST /api/predictions/batch/upload`

**支持的文件格式**:
- CSV (`.csv`)
- JSON (`.json`)
- Excel (`.xlsx`, `.xls`)

**CSV格式要求**:
- 列名支持多种变体（不区分大小写）:
  - `sample_id` / `sampleId` / `Sample ID` / `sample ID` / `id` / `ID`
  - `text_description` / `textDescription` / `Text Description` / `text description` / `description` / `Description`
  - `cvss_base_score` / `cvssBaseScore` / `CVSS Base Score` / `cvss base score` / `cvss` (可选)

**JSON格式要求**:
- 支持两种格式:
  ```json
  // 格式1: 数组
  [
    {"sample_id": "...", "text_description": "..."},
    {"sample_id": "...", "text_description": "..."}
  ]
  
  // 格式2: 对象包含samples数组
  {
    "samples": [
      {"sample_id": "...", "text_description": "..."},
      {"sample_id": "...", "text_description": "..."}
    ]
  }
  ```

## 数据集文件说明

### 原始格式文件（用于参考）

- `positives.csv` - 15个正类样本（包含demo_note等额外字段）
- `negatives.csv` - 20个负类样本（包含demo_note等额外字段）
- `augmented_negatives.csv` - 30个增强负类样本（包含subclass, demo_note等额外字段）
- `all_demo.jsonl` - 所有65个样本的JSON Lines格式

### API格式文件（可直接使用）

- `positives_api_format.csv` - 正类样本，API格式
- `negatives_api_format.csv` - 负类样本，API格式
- `augmented_negatives_api_format.csv` - 增强负类样本，API格式
- `all_demo_api_format.json` - 所有样本的JSON格式（包含10个示例）

## 使用方法

### 方法1: 使用API格式文件（推荐）

直接使用 `*_api_format.csv` 或 `all_demo_api_format.json` 文件：

1. **单个预测**: 从CSV文件中读取一行，手动输入到前端界面
2. **批量预测**: 上传 `*_api_format.csv` 文件到批量预测界面

### 方法2: 转换原始格式文件

运行转换脚本：
```bash
python demo-data/convert_to_api_format.py
```

这将生成API格式的文件。

### 方法3: 手动转换

如果需要自定义，可以手动编辑CSV文件：
- 将 `sampleId` 改为 `sample_id`
- 将 `textDescription` 改为 `text_description`
- 删除不需要的列（如 `expected_applicable`, `demo_note` 等）

## 前端使用示例

### 单个预测

1. 打开 Predictions 页面
2. 点击 "Single Prediction" 按钮
3. 从 `positives_api_format.csv` 或 `negatives_api_format.csv` 复制一行数据：
   - Sample ID: `POS-001`
   - Text Description: `A remote code execution vulnerability...`
   - CVSS Base Score: (可选，留空)
4. 点击提交

### 批量预测

1. 打开 Predictions 页面
2. 点击 "Batch Import" 按钮
3. 选择 "Upload File" 标签
4. 上传 `positives_api_format.csv` 或 `negatives_api_format.csv` 或 `augmented_negatives_api_format.csv`
5. 点击提交

## 验证数据集格式

运行以下Python脚本验证格式：

```python
import csv
import json

# 验证CSV格式
def validate_csv(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        required_fields = ['sample_id', 'text_description']
        
        for i, row in enumerate(reader, 1):
            for field in required_fields:
                if field not in row or not row[field]:
                    print(f"Error in row {i}: Missing or empty '{field}'")
                    return False
    print(f"✓ {file_path} is valid")
    return True

# 验证JSON格式
def validate_json(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
        if isinstance(data, list):
            samples = data
        elif isinstance(data, dict) and 'samples' in data:
            samples = data['samples']
        else:
            print(f"Error: Invalid JSON format in {file_path}")
            return False
        
        for i, sample in enumerate(samples, 1):
            if 'sample_id' not in sample or not sample['sample_id']:
                print(f"Error in sample {i}: Missing 'sample_id'")
                return False
            if 'text_description' not in sample or not sample['text_description']:
                print(f"Error in sample {i}: Missing 'text_description'")
                return False
    
    print(f"✓ {file_path} is valid")
    return True

# 验证所有文件
validate_csv('demo-data/positives_api_format.csv')
validate_csv('demo-data/negatives_api_format.csv')
validate_csv('demo-data/augmented_negatives_api_format.csv')
validate_json('demo-data/all_demo_api_format.json')
```

## 注意事项

1. **字段名**: API要求使用下划线命名（`sample_id`, `text_description`），但批量上传支持多种变体
2. **编码**: 所有文件使用UTF-8编码
3. **CVSS分数**: 可选字段，如果不需要可以省略
4. **文件大小**: 批量上传限制为100MB
5. **样本数量**: 建议批量预测时每次不超过1000个样本，以确保响应时间

## 演示建议

### 单个预测演示（推荐3-5个样本）

**正类样本**:
- POS-002 (SQL injection, Critical)
- POS-008 (Information disclosure, Medium)
- POS-014 (Open redirect, Medium)

**负类样本**:
- NEG-001 (UI bug)
- NEG-004 (CI flakiness)

**增强负类样本**:
- AUG-KW-001 (Keyword-only)
- AUG-PATCH-001 (Patch/mitigation)

### 批量预测演示

1. 上传 `negatives_api_format.csv` (20个样本) - 展示Stage A拒绝
2. 上传 `augmented_negatives_api_format.csv` (30个样本) - 展示鲁棒性
3. 上传 `positives_api_format.csv` (15个样本) - 展示Stage B评估

---

**最后更新**: 2026-02-04


