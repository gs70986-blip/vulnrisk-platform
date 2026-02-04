# Stage A/B 分离修复总结

## 修复日期
2026-02-04

## 修复目标
严格分离Stage A（适用性门控）和Stage B（严重度/风险评估），确保解释文本清晰、正确且适合论文答辩。

## 修改的文件

### `ml-service/app.py`

## 修复内容

### A) Stage A门控逻辑修复

#### 1. 移除使用pVuln/riskScore/severityLevel的门控逻辑
- ✅ **已确认**: 两阶段预测逻辑（`predict_two_stage`函数）中**没有**使用pVuln、riskScore或severityLevel进行门控
- ✅ Stage A门控**仅使用** `pApplicable` 与 `app_threshold` 比较

#### 2. 实现正确的Stage A逻辑
**位置**: `ml-service/app.py` 第503-519行

**修复前**:
```python
if not applicable:
    return {
        'applicable': False,
        'pApplicable': float(p_applicable),
        'severityLevel': 'N/A',
        'riskLevel': 'N/A',
        'explanation': 'Text appears not vulnerability-related...',
        'reason': 'LOW_PAPPLICABLE',
        ...
    }
```

**修复后**:
```python
if not applicable:
    return {
        'applicable': False,
        'pApplicable': float(p_applicable),
        'severityLevel': None,  # 使用None而不是'N/A'
        'riskLevel': 'Unknown',  # 使用'Unknown'而不是'N/A'
        'riskScore': 0,  # 使用0而不是None
        'explanation': 'This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage.',
        'reason': 'NOT_VULNERABILITY_TEXT',  # 统一使用NOT_VULNERABILITY_TEXT
        ...
    }
```

#### 3. 证据充分性检查（Stage A的一部分）
**位置**: `ml-service/app.py` 第521-546行

**修复**:
- 更新 `explanation` 为标准化文本
- 更新 `reason` 为 `'NOT_VULNERABILITY_TEXT'`
- 设置 `riskLevel='Unknown'`, `riskScore=0`, `severityLevel=None`

### B) 解释文本标准化

#### CASE 1: applicable = false (Stage A拒绝)

**标准化文本**:
```
"This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage."
```

**应用位置**:
1. Stage A门控拒绝（第513行）
2. 证据充分性检查拒绝（第537行）
3. 输入质量检查（`check_input_quality`函数，第284, 291, 298, 309, 320行）

#### CASE 2: applicable = true AND Stage B执行

**标准化文本结构**:
```
"This input text was identified as vulnerability-related. A conditional risk assessment was performed based on learned vulnerability patterns."

如果严重度可用，追加:
" Predicted severity tendency: <SeverityLevel>. The risk score reflects a reference estimate under uncertainty."

如果可靠性低，追加:
" Due to limited or ambiguous evidence, the assessment confidence is low and results should be interpreted as reference only."
```

**应用位置**: `ml-service/app.py` 第628-638行

**修复前**:
```python
explanation = (
    f"Vulnerability-related text detected. Predicted severity: {severity_level} "
    f"(P(Low)={severity_probs_array[0]:.3f}, P(Medium)={severity_probs_array[1]:.3f}, "
    f"P(High)={severity_probs_array[2]:.3f}, P(Critical)={severity_probs_array[3]:.3f}). "
    f"Risk score: {risk_score:.3f}."
)
```

**修复后**:
```python
explanation = "This input text was identified as vulnerability-related. A conditional risk assessment was performed based on learned vulnerability patterns."

if severity_level:
    explanation += f" Predicted severity tendency: {severity_level}. The risk score reflects a reference estimate under uncertainty."

if reliability == 'Low':
    explanation += " Due to limited or ambiguous evidence, the assessment confidence is low and results should be interpreted as reference only."
```

#### CASE 3: Severity模型不可用时的后备

**位置**: `ml-service/app.py` 第559-577行

**修复**: 更新解释文本为标准化格式，包含所有必要的说明。

### C) 输入质量检查函数修复

**位置**: `ml-service/app.py` 第274-325行

**修复**: 所有质量检查返回的 `note` 文本已更新为标准化格式：
```
"This input text was not identified as vulnerability-related and therefore did not enter the risk assessment stage."
```

**修复的检查项**:
1. 文本过短（第284行）
2. 高度重复（第291行）
3. 问候语/闲聊模式（第298行）
4. 字符重复（第309行）
5. 证据不足（第320行）

### D) 字段值统一

**修复**:
- `applicable=False` 时:
  - `severityLevel`: `None` (不是 `'N/A'`)
  - `riskLevel`: `'Unknown'` (不是 `'N/A'`)
  - `riskScore`: `0` (不是 `None`)
  - `severityProbs`: `None`
  - `pVuln`: `None`

## 验证检查

### ✅ 已确认

1. **Stage A门控仅使用pApplicable**
   - ✅ 第501行: `applicable = p_applicable >= app_threshold`
   - ✅ 没有使用pVuln、riskScore或severityLevel进行门控

2. **解释文本不引用pVuln进行适用性决策**
   - ✅ 所有Stage A拒绝的解释文本都使用标准化格式
   - ✅ 没有提到"low vulnerability probability"或"pVuln < threshold"

3. **清晰区分Stage A和Stage B**
   - ✅ Stage A: "not identified as vulnerability-related"
   - ✅ Stage B: "conditional risk assessment was performed"

4. **不声称存在真实漏洞**
   - ✅ 使用"identified as vulnerability-related"（识别为漏洞相关）
   - ✅ 使用"conditional risk assessment"（条件性风险评估）
   - ✅ 使用"reference estimate under uncertainty"（不确定性下的参考估计）

## 回归检查

### 预期行为

1. **普通GitHub问题/UI bug/功能请求**:
   - `applicable = false`
   - `explanation`: "This input text was not identified as vulnerability-related..."
   - ✅ 已修复

2. **噪声/关键词但无上下文/补丁文本**:
   - `applicable = false`
   - `explanation`: 不提及概率或严重度
   - ✅ 已修复

3. **CVE类正类文本（即使pVuln < 0.3）**:
   - `applicable = true` (如果pApplicable >= threshold)
   - Stage B严重度和风险会显示
   - `explanation`: 明确说明"conditional risk assessment"
   - ✅ 已修复

## 未修改的内容

根据要求，以下内容**未修改**:
- ✅ 模型权重或训练代码
- ✅ 阈值值（除了切换到app_threshold）
- ✅ API响应模式
- ✅ Stage B严重度计算逻辑
- ✅ 旧版预测逻辑（向后兼容，使用旧模型路径时）

## 最终确认

### 修改的文件
- ✅ `ml-service/app.py`

### Stage A门控确认
- ✅ Stage A门控现在**仅使用** `pApplicable` 与 `app_threshold` 比较
- ✅ 没有使用pVuln、riskScore或severityLevel进行门控

### 解释文本确认
- ✅ 所有解释文本**不再引用**pVuln进行适用性决策
- ✅ 所有解释文本使用标准化、学术化的英语
- ✅ 清晰区分评估资格（Stage A）和严重度/风险估计（Stage B）
- ✅ 不声称存在真实漏洞，使用条件性语言

---

**状态**: ✅ 修复完成  
**验证**: ✅ 通过代码审查


