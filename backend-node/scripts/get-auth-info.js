/**
 * 获取认证信息脚本
 * 帮助用户查看和获取 JWT_TOKEN、API_USERNAME、API_PASSWORD
 * 
 * 用法:
 *   node scripts/get-auth-info.js [--create-admin] [--get-token] [--verify]
 * 
 * 示例:
 *   node scripts/get-auth-info.js                    # 显示当前用户信息
 *   node scripts/get-auth-info.js --create-admin      # 创建/更新管理员用户
 *   node scripts/get-auth-info.js --get-token         # 获取JWT token
 *   node scripts/get-auth-info.js --verify            # 验证用户名密码
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * 显示当前环境变量配置
 */
function showEnvConfig() {
  console.log('\n当前环境变量配置:');
  console.log('='.repeat(60));
  
  const config = {
    'API_BASE_URL': process.env.API_BASE_URL || 'http://localhost:3000 (默认)',
    'API_USERNAME': process.env.API_USERNAME || 'admin (默认)',
    'API_PASSWORD': process.env.API_PASSWORD ? '***已设置***' : '未设置',
    'JWT_TOKEN': process.env.JWT_TOKEN ? '***已设置***' : '未设置',
    'GITHUB_TOKEN': process.env.GITHUB_TOKEN ? '***已设置***' : '未设置',
  };

  for (const [key, value] of Object.entries(config)) {
    console.log(`  ${key}: ${value}`);
  }
}

/**
 * 创建或更新管理员用户
 */
async function createAdmin() {
  const username = process.argv[3] || 'admin';
  const password = process.argv[4] || 'admin123';
  const email = process.argv[5] || 'admin@example.com';

  console.log('\n创建/更新管理员用户...');
  console.log('='.repeat(60));

  try {
    await prisma.$connect();

    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      await prisma.user.update({
        where: { username },
        data: {
          role: 'admin',
          password: hashedPassword,
        },
      });
      console.log(`✓ 用户 ${username} 已更新为管理员`);
    } else {
      await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          role: 'admin',
        },
      });
      console.log(`✓ 管理员用户 ${username} 创建成功`);
    }

    console.log('\n用户信息:');
    console.log(`  用户名: ${username}`);
    console.log(`  密码: ${password}`);
    console.log(`  邮箱: ${email}`);
    console.log(`  角色: admin`);

    console.log('\n.env 文件配置建议:');
    console.log(`  API_USERNAME=${username}`);
    console.log(`  API_PASSWORD=${password}`);

  } catch (error) {
    console.error('✗ 错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 获取JWT token
 */
async function getToken() {
  const username = process.argv[3] || process.env.API_USERNAME || 'admin';
  const password = process.argv[4] || process.env.API_PASSWORD || 'admin123';

  console.log('\n获取JWT Token...');
  console.log('='.repeat(60));
  console.log(`用户名: ${username}`);

  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      username,
      password,
    });

    if (response.data && response.data.token) {
      console.log('\n✓ 登录成功！');
      console.log('\nJWT Token:');
      console.log('='.repeat(60));
      console.log(response.data.token);
      console.log('='.repeat(60));

      console.log('\n.env 文件配置建议:');
      console.log(`  JWT_TOKEN=${response.data.token}`);
      console.log(`  API_USERNAME=${username}`);
      console.log(`  API_PASSWORD=${password}`);

      console.log('\n用户信息:');
      console.log(`  ID: ${response.data.user.id}`);
      console.log(`  用户名: ${response.data.user.username}`);
      console.log(`  邮箱: ${response.data.user.email || 'N/A'}`);
      console.log(`  角色: ${response.data.user.role}`);

      return response.data.token;
    } else {
      throw new Error('登录响应中未找到token');
    }
  } catch (error) {
    if (error.response) {
      console.error(`✗ 登录失败 (${error.response.status}):`, error.response.data?.error || error.message);
    } else if (error.request) {
      console.error('✗ 无法连接到API服务器:', API_BASE_URL);
      console.error('  请确保后端服务正在运行 (npm run dev)');
    } else {
      console.error('✗ 错误:', error.message);
    }
    process.exit(1);
  }
}

/**
 * 验证用户名密码
 */
async function verifyCredentials() {
  const username = process.argv[3] || process.env.API_USERNAME || 'admin';
  const password = process.argv[4] || process.env.API_PASSWORD || 'admin123';

  console.log('\n验证用户名密码...');
  console.log('='.repeat(60));

  try {
    await prisma.$connect();

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        email: true,
        role: true,
        password: true,
      },
    });

    if (!user) {
      console.error(`✗ 用户 ${username} 不存在`);
      console.log('\n提示: 运行以下命令创建管理员用户:');
      console.log(`  node scripts/get-auth-info.js --create-admin`);
      process.exit(1);
    }

    const isValid = await bcrypt.compare(password, user.password);

    console.log(`用户名: ${user.username}`);
    console.log(`邮箱: ${user.email || 'N/A'}`);
    console.log(`角色: ${user.role}`);
    console.log(`密码验证: ${isValid ? '✓ 正确' : '✗ 错误'}`);

    if (!isValid) {
      console.error('\n✗ 密码不正确');
      console.log('\n提示: 运行以下命令重置密码:');
      console.log(`  node scripts/reset-password.js ${username} <new_password>`);
      process.exit(1);
    }

    console.log('\n✓ 验证成功！可以使用这些凭据登录。');

  } catch (error) {
    console.error('✗ 错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 列出所有用户
 */
async function listUsers() {
  console.log('\n数据库中的用户列表:');
  console.log('='.repeat(60));

  try {
    await prisma.$connect();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (users.length === 0) {
      console.log('  没有找到用户');
      console.log('\n提示: 运行以下命令创建管理员用户:');
      console.log(`  node scripts/get-auth-info.js --create-admin`);
    } else {
      console.table(users.map(u => ({
        '用户名': u.username,
        '邮箱': u.email || 'N/A',
        '角色': u.role,
        '创建时间': u.createdAt.toISOString().split('T')[0],
      })));
    }

  } catch (error) {
    console.error('✗ 错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('\n获取认证信息脚本');
  console.log('='.repeat(60));
  console.log('\n用法:');
  console.log('  node scripts/get-auth-info.js [选项] [参数]');
  console.log('\n选项:');
  console.log('  --create-admin [username] [password] [email]');
  console.log('    创建或更新管理员用户');
  console.log('    默认: username=admin, password=admin123, email=admin@example.com');
  console.log('\n  --get-token [username] [password]');
  console.log('    通过登录获取JWT token');
  console.log('    默认使用环境变量或 admin/admin123');
  console.log('\n  --verify [username] [password]');
  console.log('    验证用户名密码是否正确');
  console.log('    默认使用环境变量或 admin/admin123');
  console.log('\n  --list-users');
  console.log('    列出数据库中的所有用户');
  console.log('\n  --help');
  console.log('    显示此帮助信息');
  console.log('\n示例:');
  console.log('  node scripts/get-auth-info.js                    # 显示环境配置和用户列表');
  console.log('  node scripts/get-auth-info.js --create-admin      # 创建默认管理员');
  console.log('  node scripts/get-auth-info.js --create-admin myuser mypass my@email.com');
  console.log('  node scripts/get-auth-info.js --get-token         # 获取JWT token');
  console.log('  node scripts/get-auth-info.js --get-token admin admin123');
  console.log('  node scripts/get-auth-info.js --verify            # 验证凭据');
  console.log('  node scripts/get-auth-info.js --list-users         # 列出所有用户');
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  showEnvConfig();

  if (!command || command === '--help' || command === '-h') {
    showHelp();
    await listUsers();
    return;
  }

  try {
    switch (command) {
      case '--create-admin':
        await createAdmin();
        break;
      case '--get-token':
        await getToken();
        break;
      case '--verify':
        await verifyCredentials();
        break;
      case '--list-users':
        await listUsers();
        break;
      default:
        console.error(`✗ 未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('✗ 错误:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createAdmin, getToken, verifyCredentials, listUsers };



