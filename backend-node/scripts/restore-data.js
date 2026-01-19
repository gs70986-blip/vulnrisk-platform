/**
 * 数据恢复脚本
 * 恢复数据库中的基础数据（用户、模型）
 * 
 * 用法:
 *   node scripts/restore-data.js
 * 
 * 注意：
 *   - 此脚本会创建默认管理员用户
 *   - 如果有模型文件，可以自动注册
 *   - 预测数据无法自动恢复（需要备份）
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * 创建默认管理员用户
 */
async function createDefaultAdmin() {
  console.log('\n[1/3] 创建默认管理员用户...');
  
  const username = 'admin';
  const password = 'admin123';
  const email = 'admin@example.com';
  
  try {
    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });
    
    if (existingUser) {
      console.log(`✓ 用户 ${username} 已存在，跳过创建`);
      return;
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'admin',
      },
    });
    
    console.log('✓ 管理员用户创建成功:');
    console.log(`  用户名: ${username}`);
    console.log(`  密码: ${password}`);
    console.log(`  邮箱: ${email}`);
    console.log(`  角色: ${user.role}`);
    console.log('\n⚠️  请务必在首次登录后修改默认密码！');
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log(`✓ 用户 ${username} 已存在，跳过创建`);
    } else {
      console.error('✗ 创建管理员用户失败:', error.message);
      throw error;
    }
  }
}

/**
 * 查找可用的模型文件
 */
function findAvailableModels() {
  const modelsDir = path.join(__dirname, '../../ml-service/models');
  const models = [];
  
  if (!fs.existsSync(modelsDir)) {
    console.log(`⚠️  模型目录不存在: ${modelsDir}`);
    return models;
  }
  
  const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const modelPath = path.join(modelsDir, entry.name);
      const modelFile = path.join(modelPath, 'model.joblib');
      const metadataFile = path.join(modelPath, 'metadata.json');
      
      if (fs.existsSync(modelFile) && fs.existsSync(metadataFile)) {
        models.push({
          id: entry.name,
          path: modelPath,
        });
      }
    }
  }
  
  return models;
}

/**
 * 注册模型
 */
async function registerModel(modelId, modelPath) {
  try {
    // 检查模型是否已存在
    const existingModel = await prisma.mLModel.findUnique({
      where: { id: modelId },
    });
    
    if (existingModel) {
      console.log(`  ✓ 模型 ${modelId} 已存在，跳过注册`);
      return existingModel;
    }
    
    // 读取元数据
    const metadataPath = path.join(modelPath, 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    
    // 转换为 Docker 路径
    const dockerPath = `/app/models/${modelId}`;
    
    // 创建模型记录
    const model = await prisma.mLModel.create({
      data: {
        id: modelId,
        type: metadata.model_type || 'RandomForest',
        artifactPath: dockerPath,
        metrics: metadata.metrics || {},
        metadata: metadata,
        isActive: false, // 默认不激活，需要手动激活
      },
    });
    
    console.log(`  ✓ 模型 ${modelId} 注册成功`);
    return model;
    
  } catch (error) {
    console.error(`  ✗ 注册模型 ${modelId} 失败:`, error.message);
    return null;
  }
}

/**
 * 自动注册可用的模型
 */
async function autoRegisterModels() {
  console.log('\n[2/3] 查找并注册可用模型...');
  
  const models = findAvailableModels();
  
  if (models.length === 0) {
    console.log('⚠️  未找到可用的模型文件');
    console.log('   模型文件应位于: ml-service/models/<model_id>/');
    console.log('   需要包含: model.joblib 和 metadata.json');
    return;
  }
  
  console.log(`   找到 ${models.length} 个模型:`);
  
  const registeredModels = [];
  
  for (const model of models) {
    console.log(`   - ${model.id}`);
    const registered = await registerModel(model.id, model.path);
    if (registered) {
      registeredModels.push(registered);
    }
  }
  
  if (registeredModels.length > 0) {
    console.log(`\n✓ 成功注册 ${registeredModels.length} 个模型`);
    console.log('\n⚠️  注意: 模型默认未激活，需要在管理界面激活后才能使用');
  } else {
    console.log('\n⚠️  没有成功注册任何模型');
  }
}

/**
 * 显示当前数据库状态
 */
async function showDatabaseStatus() {
  console.log('\n[3/3] 数据库状态检查...');
  
  const [userCount, modelCount, predictionCount] = await Promise.all([
    prisma.user.count(),
    prisma.mLModel.count(),
    prisma.prediction.count(),
  ]);
  
  console.log(`   用户数量: ${userCount}`);
  console.log(`   模型数量: ${modelCount}`);
  console.log(`   预测数量: ${predictionCount}`);
  
  // 显示激活的模型
  const activeModel = await prisma.mLModel.findFirst({
    where: { isActive: true },
  });
  
  if (activeModel) {
    console.log(`\n✓ 当前激活的模型: ${activeModel.id}`);
  } else if (modelCount > 0) {
    console.log('\n⚠️  没有激活的模型，需要在管理界面激活一个模型');
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('数据恢复脚本');
    console.log('='.repeat(60));
    
    // 检查数据库连接
    console.log('\n检查数据库连接...');
    await prisma.$connect();
    console.log('✓ 数据库连接成功');
    
    // 创建默认管理员
    await createDefaultAdmin();
    
    // 自动注册模型
    await autoRegisterModels();
    
    // 显示数据库状态
    await showDatabaseStatus();
    
    console.log('\n' + '='.repeat(60));
    console.log('数据恢复完成！');
    console.log('='.repeat(60));
    console.log('\n后续步骤:');
    console.log('1. 登录系统 (用户名: admin, 密码: admin123)');
    console.log('2. 修改默认密码');
    console.log('3. 如果需要，激活一个模型');
    console.log('4. 如果需要，手动注册其他模型:');
    console.log('   node scripts/register-model.js <model_path> [model_id] [--activate]');
    console.log('\n⚠️  预测数据无法自动恢复，需要从备份恢复');
    
  } catch (error) {
    console.error('\n✗ 数据恢复失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createDefaultAdmin, autoRegisterModels, showDatabaseStatus };



