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

// 加载 .env 文件（从多个可能的位置）
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPaths = [
  path.join(__dirname, '..', '.env'),           // backend-node/.env
  path.join(__dirname, '..', '..', '.env'),     // 项目根目录/.env
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`[DEBUG] 加载 .env 文件: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('[WARNING] 未找到 .env 文件，将使用系统环境变量');
  console.warn(`[提示] 查找 .env 文件的位置:`);
  envPaths.forEach(p => {
    console.warn(`  ${fs.existsSync(p) ? '✓' : '✗'} ${p}`);
  });
}

const { PrismaClient } = require('@prisma/client');

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
            
            // 检查是否是 Stage B 严重度模型
            const isSeverityModel = metadata.model_function === 'severity' || 
                                   finalModelId.startsWith('sev_model_');
            
            // 如果是 Stage B 严重度模型，强制激活
            const shouldActivate = activate || isSeverityModel;
            
            // 更新现有模型
            const updatedModel = await prisma.mLModel.update({
                where: { id: finalModelId },
                data: {
                    type: metadata.model_type, // 使用 type 而不是 modelType
                    artifactPath: dockerPath,
                    metrics: metadata.metrics,
                    metadata: metadata,
                    isActive: shouldActivate ? true : existingModel.isActive
                }
            });
            
            console.log(`模型已更新: ${updatedModel.id}`);
            
            // 如果激活，需要先停用其他模型（但保留 Stage B 模型激活）
            if (shouldActivate) {
                await activateModel(finalModelId);
            }
        } else {
            console.log(`\n创建新模型记录...`);
            
            // 检查是否是 Stage B 严重度模型
            const isSeverityModel = metadata.model_function === 'severity' || 
                                   finalModelId.startsWith('sev_model_');
            
            // 如果是 Stage B 严重度模型，强制激活
            const shouldActivate = activate || isSeverityModel;
            
            // 创建新模型
            const newModel = await prisma.mLModel.create({
                data: {
                    id: finalModelId,
                    type: metadata.model_type, // 使用 metadata.model_type
                    artifactPath: dockerPath,
                    metrics: metadata.metrics,
                    metadata: metadata,
                    isActive: shouldActivate
                }
            });
            
            console.log(`模型已创建: ${newModel.id}`);
            
            // 如果激活，需要先停用其他模型（但保留 Stage B 模型激活）
            if (shouldActivate) {
                await activateModel(finalModelId);
            }
        }
        
        // 显示当前激活的模型
        const activeAppModel = await prisma.mLModel.findFirst({
            where: { 
                isActive: true,
                NOT: {
                    OR: [
                        { id: { startsWith: 'sev_model_' } },
                    ]
                }
            }
        });
        
        const activeSevModel = await prisma.mLModel.findFirst({
            where: { 
                isActive: true,
                OR: [
                    { id: { startsWith: 'sev_model_' } },
                ]
            }
        });
        
        if (activeAppModel) {
            console.log(`\n当前激活的 Stage A 模型: ${activeAppModel.id}`);
        } else {
            console.log(`\n警告: 没有激活的 Stage A 模型！`);
        }
        
        if (activeSevModel) {
            console.log(`当前激活的 Stage B 模型: ${activeSevModel.id} (始终激活)`);
        } else {
            console.log(`\n警告: 没有激活的 Stage B 模型！`);
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
 * 激活模型（停用其他所有模型，但保留 Stage B 严重度模型激活）
 */
async function activateModel(modelId) {
    console.log(`\n激活模型: ${modelId}`);
    
    // 检查是否是 Stage B 严重度模型
    const targetModel = await prisma.mLModel.findUnique({
        where: { id: modelId }
    });
    
    if (!targetModel) {
        throw new Error(`Model not found: ${modelId}`);
    }
    
    const metadata = targetModel.metadata || {};
    const isSeverityModel = metadata.model_function === 'severity' || 
                           modelId.startsWith('sev_model_');
    
    if (isSeverityModel) {
        // Stage B 严重度模型：只确保它激活，不停用其他模型
        await prisma.mLModel.update({
            where: { id: modelId },
            data: { isActive: true }
        });
        console.log(`Stage B 严重度模型 ${modelId} 已激活（保持激活状态）`);
    } else {
        // Stage A 适用性模型：停用其他 Stage A 模型，但保留 Stage B 模型激活
        await prisma.mLModel.updateMany({
            where: { 
                isActive: true,
                // 排除 Stage B 严重度模型
                NOT: {
                    OR: [
                        { id: { startsWith: 'sev_model_' } },
                    ]
                }
            },
            data: { isActive: false }
        });
        
        // 确保所有 Stage B 严重度模型保持激活
        await prisma.mLModel.updateMany({
            where: {
                OR: [
                    { id: { startsWith: 'sev_model_' } },
                ]
            },
            data: { isActive: true }
        });
        
        // 激活指定模型
        await prisma.mLModel.update({
            where: { id: modelId },
            data: { isActive: true }
        });
        
        console.log(`模型 ${modelId} 已激活`);
    }
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




