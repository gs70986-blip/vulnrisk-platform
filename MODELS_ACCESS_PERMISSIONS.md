# Models 页面访问权限说明

## ✅ 当前配置状态

### 权限设置

**所有已登录用户（包括管理员和普通用户）都可以访问 Models 页面并获取模型数据。**

### 后端配置

#### 1. 路由权限 (`backend-node/src/routes/models.ts`)

```typescript
// ✅ 只需要认证，不需要管理员权限
router.use(authenticate);
// ❌ 没有使用 requireAdmin
```

- ✅ 使用 `authenticate` 中间件：所有已登录用户可访问
- ❌ **没有**使用 `requireAdmin` 中间件：不限制管理员

#### 2. 控制器权限 (`backend-node/src/controllers/model.controller.ts`)

```typescript
export const getModels = async (req: Request, res: Response) => {
  // ✅ 没有权限检查，直接返回所有模型
  const models = await modelService.getModels();
  res.json(models);
};
```

- ✅ `getModels()` - 无权限检查
- ✅ `getModelById()` - 无权限检查  
- ✅ `activateModel()` - 无权限检查

#### 3. 服务层 (`backend-node/src/services/model.service.ts`)

```typescript
async getModels() {
  // ✅ 直接查询数据库，无权限过滤
  return prisma.mLModel.findMany({
    orderBy: { createdAt: 'desc' },
  });
}
```

### 前端配置

#### 1. 路由配置 (`frontend-vue/src/router/index.ts`)

```typescript
{
  path: '/models',
  name: 'Models',
  component: Models,
  meta: { requiresAuth: true }, // ✅ 只需要认证
  // ❌ 没有 requiresAdmin
}
```

#### 2. API 调用 (`frontend-vue/src/services/api.ts`)

```typescript
// ✅ 请求拦截器自动添加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

#### 3. Models 页面 (`frontend-vue/src/views/Models.vue`)

```typescript
const loadModels = async () => {
  // ✅ 所有已登录用户都可以调用
  models.value = await modelApi.getAll()
}
```

## 功能说明

### 所有已登录用户可以：

1. ✅ **查看所有已训练的模型**
   - 模型类型（RandomForest / XGBoost）
   - 模型指标（Accuracy, Precision, Recall, F1, ROC-AUC）
   - 模型状态（Active / Inactive）
   - 创建时间

2. ✅ **激活模型**
   - 点击 "Activate" 按钮激活模型
   - 激活后模型可用于预测

3. ✅ **查看模型详情**
   - 点击 "Details" 按钮查看详细信息
   - 查看指标图表
   - 查看特征重要性（如果有）

### 权限对比

| 功能 | 管理员 | 普通用户 |
|------|--------|----------|
| 查看模型列表 | ✅ | ✅ |
| 激活模型 | ✅ | ✅ |
| 查看模型详情 | ✅ | ✅ |
| 训练新模型 | ❌ (前端已移除) | ❌ |
| 上传数据集 | ❌ (仅管理员) | ❌ |

## 测试验证

### 测试步骤

1. **注册普通用户**
   ```bash
   POST /api/auth/register
   {
     "username": "testuser",
     "password": "test123"
   }
   ```

2. **登录获取 token**
   ```bash
   POST /api/auth/login
   {
     "username": "testuser",
     "password": "test123"
   }
   ```

3. **访问 Models API**
   ```bash
   GET /api/models
   Authorization: Bearer <token>
   ```
   **预期结果**: ✅ 返回所有模型列表

4. **前端访问**
   - 使用普通用户登录
   - 访问 `/models` 页面
   - **预期结果**: ✅ 显示所有模型，可以激活和查看详情

## 常见问题

### Q1: 普通用户看不到模型？

**可能原因**:
1. Token 未正确传递
2. 数据库中没有模型数据
3. API 调用失败

**解决方法**:
1. 检查浏览器 Network 标签，确认请求包含 `Authorization` header
2. 检查后端日志，查看是否有错误
3. 使用 Prisma Studio 确认数据库中有模型数据

### Q2: 激活模型失败？

**可能原因**:
1. Token 过期
2. 后端服务未运行
3. 模型 ID 不存在

**解决方法**:
1. 重新登录获取新 token
2. 检查后端服务状态
3. 确认模型 ID 正确

### Q3: 如何确认权限设置正确？

**检查清单**:
- [x] `backend-node/src/routes/models.ts` - 只使用 `authenticate`
- [x] `backend-node/src/controllers/model.controller.ts` - 无权限检查
- [x] `frontend-vue/src/router/index.ts` - 只设置 `requiresAuth: true`
- [x] `frontend-vue/src/services/api.ts` - 请求拦截器已配置

## 总结

✅ **所有配置已正确设置，所有已登录用户（管理员和普通用户）都可以访问 Models 页面并获取模型数据。**

如果遇到问题，请参考 `VERIFY_MODELS_ACCESS.md` 进行排查。








