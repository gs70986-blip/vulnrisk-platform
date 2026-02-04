/**
 * 清理数据库中已删除的模型记录
 * 检查模型文件是否存在，如果不存在则从数据库中删除
 */

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 加载 .env 文件
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('[WARNING] 未找到 .env 文件');
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 检查模型文件是否存在
 */
function checkModelFiles(modelPath) {
  // 将Docker路径转换为本地路径
  // /app/models/model_name -> models/model_name (相对于项目根目录)
  let localPath = modelPath;
  
  if (modelPath.startsWith('/app/models/')) {
    const modelName = modelPath.replace('/app/models/', '');
    localPath = path.join(__dirname, '..', '..', 'models', modelName);
  } else if (modelPath.startsWith('models/')) {
    localPath = path.join(__dirname, '..', '..', modelPath);
  }
  
  // 检查模型目录和必需文件
  const modelFile = path.join(localPath, 'model.joblib');
  const metadataFile = path.join(localPath, 'metadata.json');
  
  const dirExists = fs.existsSync(localPath) && fs.statSync(localPath).isDirectory();
  const modelExists = fs.existsSync(modelFile);
  const metadataExists = fs.existsSync(metadataFile);
  
  return {
    exists: dirExists && modelExists && metadataExists,
    localPath: localPath,
    modelFile: modelFile,
    metadataFile: metadataFile
  };
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('清理已删除的模型记录');
    console.log('='.repeat(60));
    
    // 检查数据库连接
    console.log('\n检查数据库连接...');
    await prisma.$connect();
    console.log('数据库连接成功');
    
    // 获取所有模型记录
    console.log('\n获取所有模型记录...');
    const allModels = await prisma.mLModel.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`找到 ${allModels.length} 个模型记录`);
    
    const modelsToDelete = [];
    const modelsToKeep = [];
    
    // 检查每个模型
    for (const model of allModels) {
      const check = checkModelFiles(model.artifactPath);
      
      if (!check.exists) {
        modelsToDelete.push({
          id: model.id,
          type: model.type,
          path: model.artifactPath,
          localPath: check.localPath
        });
      } else {
        modelsToKeep.push({
          id: model.id,
          type: model.type,
          path: model.artifactPath
        });
      }
    }
    
    // 显示结果
    console.log('\n' + '='.repeat(60));
    console.log('检查结果');
    console.log('='.repeat(60));
    
    console.log(`\n保留的模型 (${modelsToKeep.length}):`);
    modelsToKeep.forEach(m => {
      console.log(`  ✓ ${m.id} (${m.type}) - ${m.path}`);
    });
    
    console.log(`\n需要删除的模型 (${modelsToDelete.length}):`);
    modelsToDelete.forEach(m => {
      console.log(`  ✗ ${m.id} (${m.type})`);
      console.log(`    路径: ${m.path}`);
      console.log(`    本地路径: ${m.localPath}`);
    });
    
    // 删除不存在的模型
    if (modelsToDelete.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('删除不存在的模型记录...');
      console.log('='.repeat(60));
      
      for (const model of modelsToDelete) {
        try {
          // 先检查是否有相关的预测记录
          const predictionCount = await prisma.prediction.count({
            where: { modelId: model.id }
          });
          
          if (predictionCount > 0) {
            console.log(`\n警告: 模型 ${model.id} 有 ${predictionCount} 条预测记录`);
            console.log(`  将删除相关预测记录...`);
            
            // 删除相关预测记录
            await prisma.prediction.deleteMany({
              where: { modelId: model.id }
            });
            
            console.log(`  ✓ 已删除 ${predictionCount} 条预测记录`);
          }
          
          // 删除模型记录
          await prisma.mLModel.delete({
            where: { id: model.id }
          });
          
          console.log(`  ✓ 已删除模型记录: ${model.id}`);
        } catch (error) {
          console.error(`  ✗ 删除模型 ${model.id} 失败:`, error.message);
        }
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('清理完成！');
      console.log('='.repeat(60));
      console.log(`已删除 ${modelsToDelete.length} 个不存在的模型记录`);
    } else {
      console.log('\n没有需要删除的模型记录');
    }
    
    // 显示当前激活的模型
    const activeModel = await prisma.mLModel.findFirst({
      where: { isActive: true }
    });
    
    if (activeModel) {
      const check = checkModelFiles(activeModel.artifactPath);
      if (check.exists) {
        console.log(`\n当前激活的模型: ${activeModel.id} (${activeModel.type})`);
      } else {
        console.log(`\n警告: 当前激活的模型 ${activeModel.id} 文件不存在！`);
        console.log('建议运行此脚本后手动激活一个有效的模型');
      }
    } else {
      console.log('\n警告: 没有激活的模型！');
    }
    
  } catch (error) {
    console.error('\n错误:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行主函数
main();


