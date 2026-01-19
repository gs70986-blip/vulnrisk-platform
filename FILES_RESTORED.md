# 文件恢复总结

本文档列出了已恢复的所有文件。

## 核心ML服务文件 ✅

### 1. `ml-service/risk.py`
- **功能**: 风险评分计算模块
- **包含**: `calculate_risk_score()`, `get_risk_level()`, `calculate_risk_for_batch()`
- **状态**: ✅ 已恢复

### 2. `ml-service/data_exploration.py`
- **功能**: 数据探索和预处理模块
- **包含**: `load_cve_dataset()`, `preprocess_dataset()`, `save_preprocessing_report()`
- **状态**: ✅ 已恢复

### 3. `ml-service/train_risk_model.py`
- **功能**: 风险导向的模型训练脚本（完整版）
- **特性**: 
  - 支持XGBoost和Random Forest
  - 概率校准（CalibratedClassifierCV）
  - SMOTE处理类别不平衡
  - 完整的标签构建逻辑
  - 训练预测结果输出
- **状态**: ✅ 已恢复

### 4. `ml-service/infer_unseen_risk.py`
- **功能**: 对未见数据进行风险预测
- **特性**: 
  - 自动检测文本列
  - 输出P(vuln)、RiskScore、RiskLevel
  - 支持批量预测
- **状态**: ✅ 已恢复

### 5. `ml-service/plot_risk_analysis.py`
- **功能**: 风险分析可视化
- **包含图表**:
  - 风险评分分布图
  - P(vuln)直方图
  - 高风险样本图
  - 风险评分与CVSS关系图
- **状态**: ✅ 已恢复

## 配置文件 ✅

### 6. `ml-service/train_with_smote_config.json`
- **功能**: SMOTE训练配置文件
- **状态**: ✅ 已恢复

### 7. `ml-service/example_infer_config.json`
- **功能**: 推理配置示例
- **状态**: ✅ 已恢复

### 8. `ml-service/example_viz_config.json`
- **功能**: 可视化配置示例
- **状态**: ✅ 已恢复

## 后端脚本 ✅

### 9. `backend-node/scripts/register-model.js`
- **功能**: 模型注册脚本
- **特性**:
  - 将训练好的模型注册到PostgreSQL数据库
  - 支持模型激活
  - 自动路径转换（本地路径 → Docker路径）
  - 加载和保存模型元数据
- **状态**: ✅ 已恢复

## 测试数据 ✅

### 10. `test_data_generator.js`
- **功能**: 测试数据生成脚本
- **输出**: 
  - `test_data/test_samples.json` (25个样本)
  - `test_data/test_samples.csv`
- **状态**: ✅ 已恢复

### 11. `test_data/test_samples.json`
- **功能**: 25个测试样本（JSON格式）
- **状态**: ✅ 已生成

### 12. `test_data/test_samples.csv`
- **功能**: 25个测试样本（CSV格式）
- **状态**: ✅ 已生成

### 13. `test_data/example_batch_data.json`
- **功能**: 批量预测示例数据
- **状态**: ✅ 已恢复

## 文档 ✅

### 14. `BATCH_PREDICTION_DATA_FORMAT.md`
- **功能**: 批量预测数据格式说明文档
- **包含**: 数据格式、字段说明、API调用示例、响应格式
- **状态**: ✅ 已恢复

## 使用说明

### 训练模型

```bash
# 使用SMOTE训练
docker exec vulnrisk-ml python train_risk_model.py train_with_smote_config.json
```

### 注册模型

```bash
# 注册并激活模型
cd backend-node
node scripts/register-model.js ../ml-service/models/risk_model_001 risk_model_001 --activate
```

### 推理预测

```bash
# 对未见数据进行预测
docker exec vulnrisk-ml python infer_unseen_risk.py /app/data/unseen.csv /app/models/risk_model_001
```

### 可视化分析

```bash
# 生成风险分析图表
docker exec vulnrisk-ml python plot_risk_analysis.py predictions.csv risk_figures/
```

## 注意事项

1. **路径问题**: 
   - 在Docker容器内使用绝对路径（如 `/app/models/...`）
   - 在本地使用相对路径或绝对路径

2. **模型注册**: 
   - 确保模型文件已训练完成
   - 使用`register-model.js`脚本注册模型到数据库
   - 激活模型后才能进行预测

3. **数据格式**: 
   - 批量预测需要JSON格式，参考`BATCH_PREDICTION_DATA_FORMAT.md`
   - 测试数据已生成在`test_data/`目录

## 下一步

1. ✅ 所有核心文件已恢复
2. 可以开始训练新模型
3. 可以使用测试数据进行预测测试
4. 可以生成风险分析可视化

如有任何问题，请参考相关文档或检查文件内容。











