# 批量预测数据格式说明

## 概述

批量预测功能允许您一次提交多个样本进行风险预测。本文档说明输入数据的格式要求。

## 数据格式

批量预测接受JSON格式的数据，包含一个`samples`数组，每个元素代表一个要预测的样本。

### 基本格式

```json
{
  "samples": [
    {
      "description_clean": "漏洞描述文本",
      "cwe_id": "CWE-79",
      "vendor": "厂商名称",
      "product": "产品名称",
      "cvss_base": 7.5
    },
    {
      "description_clean": "另一个漏洞描述",
      "cwe_id": "CWE-89",
      "vendor": "另一个厂商",
      "product": "另一个产品"
    }
  ]
}
```

### 字段说明

#### 必需字段

- **`description_clean`** (string): 漏洞描述文本，这是模型的主要输入特征。必须提供。

#### 可选字段

- **`cwe_id`** (string): CWE漏洞类型标识符，例如 "CWE-79", "CWE-89" 等
- **`vendor`** (string): 厂商名称
- **`product`** (string): 产品名称
- **`cvss_base`** (number): CVSS基础评分 (0-10)，如果提供，将用于风险评分计算

### 示例数据

#### 示例1: 最小格式（仅必需字段）

```json
{
  "samples": [
    {
      "description_clean": "A remote code execution vulnerability exists in the web server."
    },
    {
      "description_clean": "Cross-site scripting vulnerability allows script injection."
    }
  ]
}
```

#### 示例2: 完整格式（包含所有字段）

```json
{
  "samples": [
    {
      "description_clean": "A remote code execution vulnerability exists in the web server component. An attacker can exploit this by sending a specially crafted HTTP request.",
      "cwe_id": "CWE-120",
      "vendor": "Example Corp",
      "product": "WebServer v2.0",
      "cvss_base": 9.8
    },
    {
      "description_clean": "Cross-site scripting (XSS) vulnerability allows an attacker to inject malicious scripts into web pages.",
      "cwe_id": "CWE-79",
      "vendor": "WebApp Inc",
      "product": "CMS Platform",
      "cvss_base": 6.1
    }
  ]
}
```

## API调用

### 使用curl

```bash
curl -X POST http://localhost:3000/api/predictions/batch \
  -H "Content-Type: application/json" \
  -d @batch_data.json
```

### 使用JavaScript (fetch)

```javascript
const batchData = {
  samples: [
    {
      description_clean: "漏洞描述文本",
      cwe_id: "CWE-79",
      vendor: "厂商",
      product: "产品"
    }
  ]
};

fetch('http://localhost:3000/api/predictions/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(batchData)
})
.then(response => response.json())
.then(data => console.log(data));
```

## 响应格式

批量预测的响应格式如下：

```json
{
  "predictions": [
    {
      "sampleId": "sample_1",
      "pVuln": 0.85,
      "riskScore": 0.78,
      "riskLevel": "High",
      "cvss": 7.5
    },
    {
      "sampleId": "sample_2",
      "pVuln": 0.42,
      "riskScore": 0.35,
      "riskLevel": "Low",
      "cvss": null
    }
  ],
  "summary": {
    "total": 2,
    "low": 1,
    "medium": 0,
    "high": 1,
    "critical": 0
  }
}
```

## 注意事项

1. **文本长度**: `description_clean`字段应该包含有意义的漏洞描述。过短的文本可能影响预测准确性。

2. **CVSS评分**: 如果提供了`cvss_base`，它将用于风险评分计算。如果不提供，风险评分将仅基于模型预测的`P(vuln)`。

3. **批量大小**: 建议每次提交不超过1000个样本，以确保响应时间合理。

4. **模型激活**: 确保在提交批量预测之前，已经有一个模型被激活。可以通过前端界面或API激活模型。

## 测试数据

项目根目录下的`test_data/test_samples.json`包含了25个示例样本，可以直接用于测试批量预测功能。











