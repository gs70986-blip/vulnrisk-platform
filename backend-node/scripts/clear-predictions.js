/**
 * 清空所有预测结果数据
 * 
 * 用法: node backend-node/scripts/clear-predictions.js
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量（从多个可能的位置）
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
  console.warn('[警告] 未找到 .env 文件，将使用系统环境变量');
}

const prisma = new PrismaClient();

async function clearPredictions() {
    try {
        console.log('='.repeat(60));
        console.log('清空预测结果数据');
        console.log('='.repeat(60));
        
        // 检查数据库连接
        console.log('\n检查数据库连接...');
        await prisma.$connect();
        console.log('数据库连接成功');
        
        // 获取当前预测数量
        const countBefore = await prisma.prediction.count();
        console.log(`\n当前预测记录数: ${countBefore}`);
        
        if (countBefore === 0) {
            console.log('\n数据库中没有预测记录，无需清空。');
            return;
        }
        
        // 确认操作
        console.log(`\n警告: 即将删除 ${countBefore} 条预测记录！`);
        console.log('此操作不可恢复。');
        
        // 删除所有预测记录
        console.log('\n开始删除预测记录...');
        const result = await prisma.prediction.deleteMany({});
        
        console.log(`\n成功删除 ${result.count} 条预测记录`);
        
        // 验证
        const countAfter = await prisma.prediction.count();
        console.log(`删除后预测记录数: ${countAfter}`);
        
        if (countAfter === 0) {
            console.log('\n[OK] 所有预测记录已成功清空！');
        } else {
            console.log('\n[警告] 仍有预测记录未删除，请检查。');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('操作完成！');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n错误:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// 运行脚本
clearPredictions();

