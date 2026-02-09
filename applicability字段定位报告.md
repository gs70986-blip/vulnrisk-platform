# Applicability 相关字段和文件定位报告

## 一、核心字段定义

### 1. `applicable` (boolean)
- **含义**: 是否通过 Stage A 适用性门控
- **取值**: `true` / `false`
- **判断逻辑**: `applicable = pApplicable >= app_threshold` (默认阈值 0.5)

### 2. `pApplicable` (float)
- **含义**: Stage A 适用性概率，P(applicable=1)
- **取值范围**: [0, 1]
- **来源**: Applicability 模型预测结果

### 3. `app_threshold` (float)
- **含义**: Applicability 模型阈值
- **默认值**: 0.5
- **来源**: 模型 metadata 或函数参数

---

## 二、后端文件 (Backend)

### 2.1 ML Service (Python)

#### `ml-service/app.py`
**主要函数和位置：**

1. **`predict_two_stage()`** (第 419-656 行)
   - 两阶段预测主函数
   - **第 498-501 行**: 计算 `pApplicable` 和 `applicable`
     ```python
     p_applicable = app_model.predict_proba(X_app)[0, 1]
     applicable = p_applicable >= app_threshold
     ```
   - **第 504-519 行**: `applicable=False` 时的返回结果
   - **第 530-538 行**: 证据不足时的 `applicable=False` 返回
   - **第 445-458 行**: 输入质量检查时的 `applicable=False` 返回

2. **`check_input_quality()`** (第 274-325 行)
   - 输入质量检查，可能返回 `applicable=False`

3. **`extract_evidence()`** (第 327-415 行)
   - 提取证据，用于判断是否适用

#### `ml-service/risk.py`
**主要函数：**

1. **`assess_applicability()`** (第 223-345 行)
   - 评估适用性的工程裁剪函数
   - **返回字段**: `applicable` (bool), `reason` (string)
   - **裁剪条件**:
     - `EMPTY_TEXT`: 文本为空
     - `LOW_SIMILARITY`: 相似度过低
     - `LOW_SIGNAL`: TF-IDF 特征太少
     - `LOW_PVULN`: 概率极低

#### `ml-service/train_applicability_model.py`
- **用途**: 训练 Applicability 模型
- **输出**: 生成 `app_model_*` 系列模型
- **模型类型**: `applicability`

---

### 2.2 Backend Node.js

#### `backend-node/src/services/prediction.service.ts`
**字段使用位置：**

1. **`predict()`** (第 20-145 行)
   - **第 75-76 行**: 从 ML 服务响应提取 `pApplicable`, `applicable`
   - **第 100-101 行**: 存储到 metadata
   - **第 129-130 行**: 批量预测时提取

2. **`batchPredict()`** (第 147-245 行)
   - **第 196 行**: 提取 `p_vuln_raw` 或 `pApplicable`
   - **第 201-202 行**: 提取 `pApplicable`, `applicable`

3. **`getPredictions()`** (第 247-287 行)
   - **第 275-276 行**: 从 metadata 提取 `pApplicable`, `applicable`

4. **`getPredictionById()`** (第 289-316 行)
   - **第 310-311 行**: 从 metadata 提取 `pApplicable`, `applicable`

5. **`getAllPredictionsForExport()`** (第 327-353 行)
   - **第 357-358 行**: 提取 `applicable`, `pApplicable` 用于导出

6. **`exportToCSV()`** (第 355-385 行)
   - **第 372 行**: CSV 表头包含 `Applicable`, `pApplicable`
   - **第 377 行**: 列定义
   - **第 408-409 行**: 导出数据

7. **`exportToExcel()`** (第 387-407 行)
   - **第 443-444 行**: Excel 导出包含 `Applicable`, `pApplicable`

#### `backend-node/src/controllers/prediction.controller.ts`
- 预测控制器，调用 `prediction.service.ts` 的方法

---

### 2.3 数据库 Schema

#### `backend-node/prisma/schema.prisma`
- **Prediction 模型** (第 36-53 行)
  - `metadata` 字段 (Json 类型) 存储 `applicable` 和 `pApplicable`
  - 不在数据库表中直接存储，而是存储在 JSON metadata 中

#### SQL 查询示例 (`query.sql`)
```sql
metadata->>'applicable' as applicable,
metadata->>'pApplicable' as pApplicable,
```

---

## 三、前端文件 (Frontend)

### 3.1 类型定义和工具函数

#### `frontend-vue/src/utils/predictionMapper.ts`
**接口定义：**
```typescript
export interface PredictionData {
  pApplicable?: number | null;
  applicable?: boolean | null;
  // ...
}
```

**工具函数：**
- **`getDisplayApplicableProb()`** (第 46-48 行): 获取 `pApplicable` 显示值
- **`getDisplayApplicable()`** (第 67-69 行): 获取 `applicable` 显示值

#### `frontend-vue/src/services/api.ts`
**接口定义：**
- **第 63 行**: `applicable?: boolean`
- **第 88-89 行**: `pApplicable?: number | null`, `applicable?: boolean | null`

### 3.2 视图组件

#### `frontend-vue/src/views/Predictions.vue`
**使用位置：**

1. **表格列定义** (第 51-64 行)
   - `P(Applicable)` 列显示 `pApplicable` 值
   - 使用进度条显示

2. **函数定义** (第 660-663 行)
   ```typescript
   const getPApplicable = (prediction: any): number => {
     if (prediction.pApplicable !== null && prediction.pApplicable !== undefined) {
       return prediction.pApplicable
     }
     // ...
   }
   ```

3. **适用性判断** (第 700-702 行)
   ```typescript
   const applicable = prediction.applicable !== false
   ```

#### `frontend-vue/src/views/Report.vue`
**使用位置：**

1. **显示 Applicability 状态** (第 40-44 行)
   ```vue
   <el-tag :type="prediction.applicable ? 'success' : 'info'">
     {{ prediction.applicable ? 'Applicable' : 'Not Applicable' }}
   </el-tag>
   <span v-if="prediction.pApplicable !== null">
     ({{ formatPercent(prediction.pApplicable) }})
   </span>
   ```

2. **条件渲染** (第 425-427 行)
   ```typescript
   const applicable = prediction.value.applicable !== false
   ```

---

## 四、数据库查询脚本

### 4.1 Prisma 查询脚本

#### `backend-node/scripts/query-db.js`
**使用位置：**
- **第 108-109 行**: 打印 `applicable`, `pApplicable`
- **第 125-136 行**: 统计 `applicable` 和 `notApplicable` 数量

### 4.2 SQL 查询脚本

#### `query.sql`
**查询语句：**
```sql
metadata->>'applicable' as applicable,
metadata->>'pApplicable' as pApplicable,
```

---

## 五、文档文件

### 5.1 技术文档
- `VulnRisk项目详细技术报告.md`
- `项目详细技术报告-完整版.md`
- `两阶段重训方案-实施总结.md`
- `两阶段重训方案-现状扫描.md`
- `Stage_A_B分离修复总结.md`
- `修复总结-强制两阶段流程.md`

### 5.2 修复总结文档
- `通用门控机制更新总结.md`
- `系统级处理机制实施总结.md`
- `前端重构总结.md`

---

## 六、数据流

### 6.1 预测流程
```
输入文本
  ↓
ml-service/app.py::predict_two_stage()
  ↓
Stage A: 计算 pApplicable
  ↓
判断: applicable = p_applicable >= app_threshold
  ↓
如果 applicable = False:
  → 返回 early，不进入 Stage B
如果 applicable = True:
  → 进入 Stage B 严重度预测
  ↓
返回结果包含: applicable, pApplicable
  ↓
backend-node/src/services/prediction.service.ts
  ↓
存储到数据库 metadata 字段
  ↓
前端显示
```

### 6.2 字段存储位置

1. **ML Service 响应** (JSON)
   ```json
   {
     "applicable": true,
     "pApplicable": 0.95,
     ...
   }
   ```

2. **数据库** (PostgreSQL)
   - 表: `predictions`
   - 字段: `metadata` (JSONB)
   - 路径: `metadata.applicable`, `metadata.pApplicable`

3. **前端显示**
   - `Predictions.vue`: 表格列
   - `Report.vue`: 详情页

---

## 七、关键配置

### 7.1 模型路径
- **默认路径**: `/app/models/app_model_002_aug_xgb`
- **备选路径**: 
  - `app_model_002_aug_rf`
  - `app_model_002_aug_lr`
  - `app_model_001` (回退)

### 7.2 阈值配置
- **默认阈值**: `app_threshold = 0.5`
- **来源**: 模型 metadata 或函数参数
- **位置**: `ml-service/app.py` 第 487 行

---

## 八、相关函数和类

### 8.1 Python 函数
- `predict_two_stage()` - 两阶段预测主函数
- `check_input_quality()` - 输入质量检查
- `extract_evidence()` - 提取证据
- `assess_applicability()` - 适用性评估（工程裁剪）

### 8.2 TypeScript 函数
- `getDisplayApplicableProb()` - 获取适用性概率
- `getDisplayApplicable()` - 获取适用性状态
- `getPApplicable()` - 获取 P(Applicable) 值

### 8.3 服务类
- `PredictionService` - 预测服务类
- `DatasetService` - 数据集服务类

---

## 九、总结

### 核心文件清单

**后端 (Python):**
1. `ml-service/app.py` - 主要预测逻辑
2. `ml-service/risk.py` - 风险评估和适用性检查
3. `ml-service/train_applicability_model.py` - 模型训练

**后端 (Node.js):**
1. `backend-node/src/services/prediction.service.ts` - 预测服务
2. `backend-node/src/controllers/prediction.controller.ts` - 控制器
3. `backend-node/scripts/query-db.js` - 查询脚本

**前端:**
1. `frontend-vue/src/utils/predictionMapper.ts` - 字段映射工具
2. `frontend-vue/src/views/Predictions.vue` - 预测列表页
3. `frontend-vue/src/views/Report.vue` - 预测详情页
4. `frontend-vue/src/services/api.ts` - API 接口定义

**数据库:**
1. `backend-node/prisma/schema.prisma` - 数据库 Schema
2. `query.sql` - SQL 查询示例

**文档:**
- 多个 Markdown 文档包含详细说明

---

**生成时间**: 2026-02-10
**版本**: 1.0

