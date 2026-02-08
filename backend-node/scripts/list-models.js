require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listModels() {
  try {
    const models = await prisma.mLModel.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('已注册的模型数量:', models.length);
    console.log('');
    
    if (models.length === 0) {
      console.log('没有找到已注册的模型');
      return;
    }
    
    models.forEach((m, index) => {
      console.log(`${index + 1}. ${m.id}`);
      console.log(`   类型: ${m.type}`);
      console.log(`   激活: ${m.isActive ? '是' : '否'}`);
      console.log(`   路径: ${m.artifactPath}`);
      console.log(`   创建时间: ${m.createdAt}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

listModels();


