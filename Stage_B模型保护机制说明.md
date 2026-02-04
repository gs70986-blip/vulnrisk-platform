# Stage B 严重度模型保护机制说明

## 概述

为确保预测功能正常工作，Stage B 严重度模型（`sev_model_001`）需要始终处于激活状态，且不在前端页面显示。

## 实施内容

### 1. 后端服务修改

#### `backend-node/src/services/model.service.ts`

**`getModels()` 方法**:
- 过滤掉 Stage B 严重度模型，不在前端显示
- 通过 `metadata.model_function === 'severity'` 或 `id.startsWith('sev_model_')` 判断

**`activateModel()` 方法**:
- 禁止手动激活/停用 Stage B 严重度模型
- 激活 Stage A 模型时，自动确保 Stage B 模型保持激活状态
- 只停用其他 Stage A 模型，不影响 Stage B 模型

**`getActiveModel()` 方法**:
- 只返回激活的 Stage A 模型（适用性模型）
- 排除 Stage B 严重度模型

**新增 `getActiveSeverityModel()` 方法**:
- 专门用于获取激活的 Stage B 严重度模型
- 确保预测服务可以正确获取 Stage B 模型

#### `backend-node/src/services/prediction.service.ts`

**`predict()` 方法**:
- 获取激活模型时，排除 Stage B 严重度模型
- 只查询 Stage A 适用性模型

### 2. 前端修改

#### `frontend-vue/src/views/Models.vue`

**`loadModels()` 方法**:
- 双重过滤：后端已过滤，前端也进行过滤（双重保险）
- 过滤掉 `metadata.model_function === 'severity'` 或 `id.startsWith('sev_model_')` 的模型

### 3. 注册脚本修改

#### `backend-node/scripts/register-model.js`

**`activateModel()` 函数**:
- Stage B 严重度模型：只确保激活，不停用其他模型
- Stage A 适用性模型：停用其他 Stage A 模型，但保留 Stage B 模型激活

**`registerModel()` 函数**:
- 检测 Stage B 严重度模型时，自动强制激活
- 更新现有模型时，如果是 Stage B 模型，自动激活

## 模型识别方式

Stage B 严重度模型通过以下方式识别：
1. **metadata.model_function === 'severity'**
2. **id.startsWith('sev_model_')**

## 当前状态

- ✅ `sev_model_001` 已激活（始终激活）
- ✅ `app_model_002_aug_xgb` 已激活（Stage A 模型）
- ✅ 前端页面不显示 Stage B 模型
- ✅ 激活 Stage A 模型时，Stage B 模型保持激活

## 验证

运行以下命令验证：

```bash
# 激活 Stage A 模型（应该保持 Stage B 模型激活）
node backend-node/scripts/register-model.js models/app_model_002_aug_xgb app_model_002_aug_xgb --activate

# 检查当前状态
node backend-node/scripts/cleanup-models.js
```

## 注意事项

1. **Stage B 模型不能手动停用**：尝试激活/停用 Stage B 模型会抛出错误
2. **自动保护**：激活任何 Stage A 模型时，系统会自动确保 Stage B 模型保持激活
3. **前端隐藏**：Stage B 模型不会在 Models 页面显示，但始终在后台激活
4. **预测功能**：预测服务会自动使用激活的 Stage A 模型和始终激活的 Stage B 模型

---

**实施日期**: 2026-02-04  
**状态**: ✅ 已完成


