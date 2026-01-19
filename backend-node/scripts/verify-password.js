/**
 * 验证用户密码脚本
 * 
 * 用法:
 *   node scripts/verify-password.js <username> <password>
 * 
 * 示例:
 *   node scripts/verify-password.js admin mypassword
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function verifyPassword(username, password) {
  try {
    console.log('='.repeat(60));
    console.log('验证用户密码');
    console.log('='.repeat(60));
    
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        email: true,
        role: true,
        password: true
      }
    });
    
    if (!user) {
      console.error(`\n错误: 用户 ${username} 不存在`);
      process.exit(1);
    }
    
    console.log(`\n用户信息:`);
    console.log(`  用户名: ${user.username}`);
    console.log(`  邮箱: ${user.email || 'N/A'}`);
    console.log(`  角色: ${user.role}`);
    
    console.log(`\n验证密码...`);
    const isValid = await bcrypt.compare(password, user.password);
    
    console.log('\n' + '='.repeat(60));
    if (isValid) {
      console.log('✓ 密码正确');
    } else {
      console.log('✗ 密码错误');
    }
    console.log('='.repeat(60));
    
    process.exit(isValid ? 0 : 1);
    
  } catch (error) {
    console.error('\n错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('用法: node scripts/verify-password.js <username> <password>');
    console.error('\n示例:');
    console.error('  node scripts/verify-password.js admin mypassword');
    process.exit(1);
  }
  
  const username = args[0];
  const password = args[1];
  
  await verifyPassword(username, password);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { verifyPassword };





