# 论文答辩演示数据集

## 概述

本数据集用于论文答辩演示两阶段漏洞风险评估系统：
- **Stage A**: 适用性门控（Applicability Gate）- 判断输入是否与漏洞相关
- **Stage B**: 风险/严重度评估（Risk/Severity Assessment）- 对通过Stage A的输入进行严重度分类

## 数据集说明

### 1. 正类数据集 (`positives.csv`)
- **样本数**: 15
- **用途**: 演示Stage B功能
- **特点**: 
  - 包含明确的漏洞类型、攻击场景和影响描述
  - 包含上下文线索（attacker, remote, arbitrary, execute, unauthorized等）
  - 应该通过Stage A并进入Stage B
  - 每个样本标注了预期的严重度倾向（Low/Medium/High/Critical）

### 2. 负类数据集 (`negatives.csv`)
- **样本数**: 20
- **用途**: 演示Stage A拒绝非漏洞相关文本
- **特点**:
  - 普通GitHub工程问题文本（功能请求、重构、文档、CI、UI、构建错误等）
  - 不包含安全关键词（XSS/SQLi/RCE/overflow等）
  - 应该被Stage A拒绝（applicable=false）

### 3. 增强负类数据集 (`augmented_negatives.csv`)
- **样本数**: 30（3个子类各10个）
- **用途**: 演示Stage A的鲁棒性
- **子类**:
  - **noise** (10个): 噪声/闲聊/日志类文本
  - **keyword_only** (10个): 仅包含安全关键词但无漏洞上下文
  - **patch_mitigation** (10个): 补丁/缓解风格文本
- **特点**: 应该被Stage A拒绝，即使包含安全关键词或补丁描述

## 推荐演示顺序

### 第一步：演示Stage A拒绝负类（5-7分钟）
1. 运行 `negatives.csv` 中的样本（选择3-5个）
   - 预期：`applicable=false`, `pApplicable < 0.5`
   - 说明：系统正确识别非漏洞相关文本

2. 运行 `augmented_negatives.csv` 中的样本（每个子类选择2-3个）
   - **noise子类**: 展示系统拒绝噪声输入
   - **keyword_only子类**: 展示系统拒绝仅有关键词但无上下文的输入
   - **patch_mitigation子类**: 展示系统识别并标记补丁/缓解文本
   - 预期：`applicable=false` 或 `reliability=Low` with patch/mitigation note

### 第二步：演示Stage B功能（5-7分钟）
3. 运行 `positives.csv` 中的样本（选择5-8个，覆盖不同严重度）
   - 预期：`applicable=true`, `pApplicable >= 0.5`
   - 展示Stage B输出：
     - `severityLevel`: Low/Medium/High/Critical
     - `severityProbs`: 4类概率分布
     - `riskScore`: 风险评分
   - 说明：系统正确评估漏洞严重度

### 第三步：总结（1-2分钟）
4. 强调系统设计：
   - Stage A作为门控，过滤非漏洞文本
   - Stage B对通过门控的文本进行细粒度严重度评估
   - 增强负类训练提高了鲁棒性

## PPT推荐样本（Top 6）

### 负类拒绝示例（2个）
1. **NEG-001**: "The login button does not respond when clicked on mobile devices..."
   - 预期输出: `applicable=false`, `pApplicable < 0.3`
   - 说明: UI bug，无安全关键词，正确拒绝

2. **AUG-KW-001**: "TODAY IS A GOOD DAY XSS"
   - 预期输出: `applicable=false`, `reliability=Low`, note说明证据不足
   - 说明: 关键词但无上下文，系统保守拒绝

### 补丁/缓解检测示例（1个）
3. **AUG-PATCH-001**: "Fix: Prevent command injection by sanitizing user input..."
   - 预期输出: `applicable=true` (可能) 但 `reliability=Low`, `inputType=patch_mitigation`, 有警告note
   - 说明: 系统识别补丁文本并标记为需要保守解释

### Stage B评估示例（3个，覆盖不同严重度）
4. **POS-002**: SQL injection with data exposure
   - 预期输出: `applicable=true`, `severityLevel=Critical`, `riskScore > 0.8`
   - 说明: 严重漏洞，系统正确评估为Critical

5. **POS-008**: Information disclosure with stack traces
   - 预期输出: `applicable=true`, `severityLevel=Medium`, `riskScore ~0.4-0.6`
   - 说明: 中等严重度，信息泄露但无直接代码执行

6. **POS-014**: Open redirect with phishing potential
   - 预期输出: `applicable=true`, `severityLevel=Medium`, `riskScore ~0.4-0.6`
   - 说明: 中等严重度，开放重定向风险

## 文件格式

### 原始格式文件（用于参考）
- `positives.csv`, `negatives.csv`, `augmented_negatives.csv`: 包含完整信息（sampleId, textDescription, demo_note等）
- `all_demo.jsonl`: 所有65个样本的JSON Lines格式

### API格式文件（可直接用于预测）
- `positives_api_format.csv`, `negatives_api_format.csv`, `augmented_negatives_api_format.csv`: 符合API要求的CSV格式（sample_id, text_description）
- `all_demo_api_format.json`: JSON格式，包含所有样本

**重要**: 使用Predictions页面进行预测时，请使用 `*_api_format.csv` 或 `all_demo_api_format.json` 文件。

详细说明请参考 `API_FORMAT_GUIDE.md`。

## 使用示例

### Python示例
```python
import pandas as pd
import json

# 读取正类数据集
positives = pd.read_csv('demo-data/positives.csv')
print(f"正类样本数: {len(positives)}")

# 读取负类数据集
negatives = pd.read_csv('demo-data/negatives.csv')
print(f"负类样本数: {len(negatives)}")

# 读取增强负类数据集
augmented = pd.read_csv('demo-data/augmented_negatives.csv')
print(f"增强负类样本数: {len(augmented)}")

# 读取JSONL格式
with open('demo-data/all_demo.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        sample = json.loads(line)
        print(sample['sampleId'], sample['textDescription'][:50])
```

### 批量预测示例
```python
# 使用all_demo.jsonl进行批量预测
import json

with open('demo-data/all_demo.jsonl', 'r', encoding='utf-8') as f:
    samples = [json.loads(line) for line in f]

# 发送到预测API
for sample in samples:
    response = predict_api(sample['textDescription'])
    print(f"{sample['sampleId']}: applicable={response['applicable']}")
```

## 注意事项

1. **不要使用真实CVE文本**: 所有样本都是合成的，避免版权和隐私问题
2. **演示前测试**: 建议在演示前运行所有样本，确保系统行为符合预期
3. **准备备用样本**: 如果某个样本表现异常，准备备用样本替换
4. **解释系统行为**: 对于边界情况（如patch文本可能applicable=true但reliability=Low），准备解释说明

## 数据集统计

- **总样本数**: 65
  - 正类: 15
  - 负类: 20
  - 增强负类: 30
    - noise: 10
    - keyword_only: 10
    - patch_mitigation: 10

---

**创建日期**: 2026-02-04  
**用途**: 论文答辩演示  
**状态**: ✅ 已生成

