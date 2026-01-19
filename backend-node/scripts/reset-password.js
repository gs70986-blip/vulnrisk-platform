/**
 * 重置用户密码脚本
 * 
 * 用法:
 *   node scripts/reset-password.js <username> <new_password>
 * 
 * 示例:
 *   node scripts/reset-password.js admin newpassword123
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPassword(username, newPassword) {
  try {
    console.log('='.repeat(60));
    console.log('重置用户密码');
    console.log('='.repeat(60));
    console.log(`\n正在重置用户 ${username} 的密码...`);
    
    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });
    
    if (!existingUser) {
      console.error(`\n错误: 用户 ${username} 不存在`);
      process.exit(1);
    }
    
    // 生成密码哈希
    console.log('生成密码哈希...');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新数据库
    const user = await prisma.user.update({
      where: { username },
      data: { password: hashedPassword }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('密码重置成功！');
    console.log('='.repeat(60));
    console.log(`用户名: ${user.username}`);
    console.log(`邮箱: ${user.email || 'N/A'}`);
    console.log(`角色: ${user.role}`);
    console.log(`新密码: ${newPassword}`);
    console.log('\n请妥善保管新密码！');
    
  } catch (error) {
    console.error('\n错误:', error.message);
    if (error.code === 'P2025') {
      console.error(`用户 ${username} 不存在`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('用法: node scripts/reset-password.js <username> <new_password>');
    console.error('\n示例:');
    console.error('  node scripts/reset-password.js admin newpassword123');
    console.error('\n注意: 密码将被加密存储，无法查看原始密码');
    process.exit(1);
  }
  
  const username = args[0];
  const newPassword = args[1];
  
  if (newPassword.length < 6) {
    console.error('错误: 密码长度至少需要6个字符');
    process.exit(1);
  }
  
  await resetPassword(username, newPassword);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { resetPassword };





