# 工程裁剪（Business Clipping）实现总结

## 实现概览

已实现"工程裁剪（business clipping）"功能，对明显非漏洞语境文本强制将 pVuln、riskScore 置 0，并将 riskLevel 输出为 "N/A"。

## 修改文件清单

1. **ml-service/risk.py** - 新增 `assess_applicability()` 函数
2. **ml-service/app.py** - 集成裁剪逻辑和环境变量配置
3. **backend-node/src/services/prediction.service.ts** - 透传 explanation 和 meta 字段（待完成）
4. **frontend-vue/src/views/Predictions.vue** - 支持 N/A 展示和 explanation tooltip（已部分完成）

## 关键实现

### 1. ml-service/risk.py - assess_applicability() 函数

```python
def assess_applicability(text, p_vuln, similarity_meta=None, tfidf_meta=None, cvss_input=None, ...):
    """
    评估输入文本是否适用于漏洞风险评估（工程裁剪）
    """
    # 裁剪触发条件（按优先级）：
    # 1) 空或过短: text_len < CLIP_MIN_TEXT_LEN
    # 2) 相似度过低: max_similarity < CLIP_SIM_THRESHOLD 且无用户 CVSS
    # 3) 信号太弱: nonzero_features < CLIP_MIN_NONZERO_TFIDF 且无用户 CVSS
    # 4) 概率极低: p_vuln < CLIP_PVULN_THRESHOLD 且相似度低或无相似度
```

### 2. ml-service/app.py - 环境变量配置

```python
# Business clipping configuration
CLIP_NA_ENABLED = os.getenv('CLIP_NA_ENABLED', 'true').lower() == 'true'
CLIP_PVULN_THRESHOLD = float(os.getenv('CLIP_PVULN_THRESHOLD', '0.10'))
CLIP_SIM_THRESHOLD = float(os.getenv('CLIP_SIM_THRESHOLD', '0.18'))
CLIP_MIN_TEXT_LEN = int(os.getenv('CLIP_MIN_TEXT_LEN', '20'))
CLIP_MIN_NONZERO_TFIDF = int(os.getenv('CLIP_MIN_NONZERO_TFIDF', '3'))
```

### 3. 单次预测中的裁剪逻辑

```python
# 获取 CVSS（在裁剪之前）
cvss_base_score = ...  # 估算或用户提供

# 适用性判定
applicability = assess_applicability(
    text=processed_text,
    p_vuln=p_vuln,
    similarity_meta=cvss_sim_meta,
    tfidf_meta={'nonzero_features': nonzero_features},
    cvss_input=cvss_base_score_input,
    ...
)

# 根据结果裁剪
if not applicability['applicable'] and CLIP_NA_ENABLED:
    p_vuln = 0.0
    risk_score = 0.0
    risk_level = 'N/A'
    explanation = ...  # 基于 reason 的说明
```

### 4. 响应结构

```json
{
  "p_vuln": 0,
  "risk_score": 0,
  "risk_level": "N/A",
  "explanation": "Input text not vulnerability-related; scoring not applicable.",
  "meta": {
    "applicable": false,
    "reason": "LOW_SIMILARITY",
    "max_similarity": 0.04,
    "nonzero_features": 2,
    "text_len": 36,
    "thresholds": {...}
  }
}
```

## 测试用例

1. **"today is a good day, i am very happy"** 
   - 预期：`riskLevel="N/A"`, `pVuln=0`, `riskScore=0`
   - 触发条件：`LOW_PVULN` 或 `LOW_SIMILARITY`

2. **"refactor code and update README, fix typos, improve CI pipeline"**
   - 预期：如果相似度很低且无 cvss → `N/A`

3. **真实 CVE 描述**
   - 预期：`applicable=true`，正常输出 `riskLevel`

4. **用户提供 cvss 的普通文本**
   - 预期：允许走融合逻辑，但仍记录 `meta`

## 待完成项

1. **批量预测更新** - 需要将批量预测逻辑也更新为使用 `assess_applicability`
2. **后端透传** - 确保 `explanation` 和 `meta` 字段正确透传到前端
3. **前端展示** - 确保 N/A 标签和 explanation tooltip 正常工作

## 环境变量

需要在 `.env` 或环境配置中设置：

```env
CLIP_NA_ENABLED=true
CLIP_PVULN_THRESHOLD=0.10
CLIP_SIM_THRESHOLD=0.18
CLIP_MIN_TEXT_LEN=20
CLIP_MIN_NONZERO_TFIDF=3
```



