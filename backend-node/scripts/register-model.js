/**
 * 模型注册脚本
 * 将训练好的模型注册到PostgreSQL数据库中
 * 
 * 用法:
 *   node scripts/register-model.js <model_path> [model_id] [--activate]
 * 
 * 示例:
 *   node scripts/register-model.js ../ml-service/models/risk_model_001
 *   node scripts/register-model.js ../ml-service/models/risk_model_001 risk_model_001 --activate
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * 解析模型路径，返回Docker容器内的路径
 */
function resolveModelPath(modelPath) {
    // 如果是相对路径，转换为绝对路径
    if (!path.isAbsolute(modelPath)) {
        modelPath = path.resolve(process.cwd(), modelPath);
    }
    
    // 检查模型目录是否存在
    if (!fs.existsSync(modelPath)) {
        throw new Error(`模型目录不存在: ${modelPath}`);
    }
    
    // 检查必要的文件
    const modelFile = path.join(modelPath, 'model.joblib');
    const metadataFile = path.join(modelPath, 'metadata.json');
    
    if (!fs.existsSync(modelFile)) {
        throw new Error(`模型文件不存在: ${modelFile}`);
    }
    
    if (!fs.existsSync(metadataFile)) {
        throw new Error(`元数据文件不存在: ${metadataFile}`);
    }
    
    // 转换为Docker容器内的路径
    // 假设模型存储在 /app/models/ 目录下
    const modelName = path.basename(modelPath);
    const dockerPath = `/app/models/${modelName}`;
    
    return {
        localPath: modelPath,
        dockerPath: dockerPath,
        modelName: modelName
    };
}

/**
 * 加载模型元数据
 */
function loadMetadata(metadataPath) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    return metadata;
}

/**
 * 注册模型到数据库
 */
async function registerModel(modelPath, modelId = null, activate = false) {
    try {
        console.log('='.repeat(60));
        console.log('模型注册脚本');
        console.log('='.repeat(60));
        
        // 检查数据库连接
        console.log('\n检查数据库连接...');
        await prisma.$connect();
        console.log('数据库连接成功');
        
        // 解析模型路径
        console.log(`\n解析模型路径: ${modelPath}`);
        const { dockerPath, modelName } = resolveModelPath(modelPath);
        console.log(`Docker路径: ${dockerPath}`);
        
        // 加载元数据
        const metadataPath = path.join(modelPath, 'metadata.json');
        console.log(`\n加载元数据: ${metadataPath}`);
        const metadata = loadMetadata(metadataPath);
        console.log(`模型类型: ${metadata.model_type}`);
        console.log(`性能指标:`, metadata.metrics);
        
        // 确定模型ID
        const finalModelId = modelId || modelName;
        console.log(`\n模型ID: ${finalModelId}`);
        
        // 检查模型是否已存在
        const existingModel = await prisma.mLModel.findUnique({
            where: { id: finalModelId }
        });
        
        if (existingModel) {
            console.log(`\n模型 ${finalModelId} 已存在，将更新...`);
            
            // 更新现有模型
            const updatedModel = await prisma.mLModel.update({
                where: { id: finalModelId },
                data: {
                    type: metadata.model_type, // 使用 type 而不是 modelType
                    artifactPath: dockerPath,
                    metrics: metadata.metrics,
                    metadata: metadata,
                    isActive: activate ? true : existingModel.isActive
                }
            });
            
            console.log(`模型已更新: ${updatedModel.id}`);
            
            // 如果激活，需要先停用其他模型
            if (activate) {
                await activateModel(finalModelId);
            }
        } else {
            console.log(`\n创建新模型记录...`);
            
            // 创建新模型
            const newModel = await prisma.mLModel.create({
                data: {
                    id: finalModelId,
                    type: metadata.model_type, // 使用 type 而不是 modelType
                    artifactPath: dockerPath,
                    metrics: metadata.metrics,
                    metadata: metadata,
                    isActive: activate
                }
            });
            
            console.log(`模型已创建: ${newModel.id}`);
            
            // 如果激活，需要先停用其他模型
            if (activate) {
                await activateModel(finalModelId);
            }
        }
        
        // 显示当前激活的模型
        const activeModel = await prisma.mLModel.findFirst({
            where: { isActive: true }
        });
        
        if (activeModel) {
            console.log(`\n当前激活的模型: ${activeModel.id}`);
        } else {
            console.log(`\n警告: 没有激活的模型！`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('模型注册完成！');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n错误:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

/**
 * 激活模型（停用其他所有模型）
 */
async function activateModel(modelId) {
    console.log(`\n激活模型: ${modelId}`);
    
    // 停用所有模型
    await prisma.mLModel.updateMany({
        where: { isActive: true },
        data: { isActive: false }
    });
    
    // 激活指定模型
    await prisma.mLModel.update({
        where: { id: modelId },
        data: { isActive: true }
    });
    
    console.log(`模型 ${modelId} 已激活`);
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('用法: node scripts/register-model.js <model_path> [model_id] [--activate]');
        console.error('\n示例:');
        console.error('  node scripts/register-model.js ../ml-service/models/risk_model_001');
        console.error('  node scripts/register-model.js ../ml-service/models/risk_model_001 risk_model_001 --activate');
        process.exit(1);
    }
    
    const modelPath = args[0];
    let modelId = null;
    let activate = false;
    
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--activate') {
            activate = true;
        } else if (!modelId) {
            modelId = args[i];
        }
    }
    
    await registerModel(modelPath, modelId, activate);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { registerModel, activateModel };




