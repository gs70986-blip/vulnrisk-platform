# risk_score 到 riskLevel 映射验证报告

## 映射规则（ml-service/risk.py）

```python
def get_risk_level(risk_score):
    if risk_score < 0.4:
        return "Low"
    elif risk_score < 0.6:
        return "Medium"
    elif risk_score < 0.8:
        return "High"
    else:
        return "Critical"
```

## 边界值说明

- `risk_score < 0.4` → `"Low"`
- `0.4 ≤ risk_score < 0.6` → `"Medium"`
- `0.6 ≤ risk_score < 0.8` → `"High"`
- `risk_score ≥ 0.8` → `"Critical"`

## 已修复的问题

1. **ML 服务 (`ml-service/app.py`)**:
   - ✅ `predict_two_stage()` 函数现在使用 `get_risk_level(risk_score)` 计算 `riskLevel`
   - ✅ Legacy 模型路径也使用 `get_risk_level()` 映射
   - ✅ 所有返回路径都正确设置了 `riskLevel`

2. **后端 (`backend-node/src/services/prediction.service.ts`)**:
   - ✅ 单个预测：优先使用 ML 服务返回的 `riskLevel`（从 `risk_score` 映射）
   - ✅ 批量预测：优先使用 ML 服务返回的 `riskLevel`
   - ✅ 不再错误地使用 `severityLevel` 作为 `riskLevel`

## 重要区别

- **`riskLevel`**: 从 `risk_score` 映射得到的风险等级（用于显示和导出）
- **`severityLevel`**: Stage B 模型预测的严重度等级（可能与 `riskLevel` 不同）

## 验证方法

运行以下命令检查数据库中的映射：

```bash
docker exec vulnrisk-backend node scripts/check-risk-mapping.js
```

## 示例

- `risk_score = 0.68` → `riskLevel = "High"` ✓（即使 `severityLevel = "Critical"`）
- `risk_score = 0.78` → `riskLevel = "High"` ✓（即使 `severityLevel = "Critical"`）
- `risk_score = 0.80` → `riskLevel = "Critical"` ✓

