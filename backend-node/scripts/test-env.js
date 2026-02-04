/**
 * 测试环境变量加载脚本
 * 用于验证 .env 文件是否正确加载
 */

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('环境变量加载测试');
console.log('='.repeat(60));

// 查找 .env 文件
const envPaths = [
  path.join(__dirname, '..', '.env'),           // backend-node/.env
  path.join(__dirname, '..', '..', '.env'),     // 项目根目录/.env
  path.join(process.cwd(), '.env'),              // 当前工作目录/.env
];

console.log('\n查找 .env 文件:');
let envLoaded = false;
let loadedPath = null;

for (const envPath of envPaths) {
  const exists = fs.existsSync(envPath);
  console.log(`  ${exists ? '✓' : '✗'} ${envPath}`);
  
  if (exists && !envLoaded) {
    dotenv.config({ path: envPath });
    envLoaded = true;
    loadedPath = envPath;
  }
}

if (!envLoaded) {
  console.log('\n⚠️  未找到 .env 文件，尝试默认加载...');
  dotenv.config();
}

console.log(`\n${envLoaded ? '✓' : '✗'} .env 文件${envLoaded ? `已加载: ${loadedPath}` : '未找到'}`);

// 检查关键环境变量
console.log('\n环境变量检查:');
console.log('='.repeat(60));

const envVars = {
  'API_BASE_URL': process.env.API_BASE_URL,
  'API_USERNAME': process.env.API_USERNAME,
  'API_PASSWORD': process.env.API_PASSWORD ? '***已设置***' : undefined,
  'JWT_TOKEN': process.env.JWT_TOKEN ? '***已设置***' : undefined,
  'GITHUB_TOKEN': process.env.GITHUB_TOKEN ? '***已设置***' : undefined,
  'DATABASE_URL': process.env.DATABASE_URL ? '***已设置***' : undefined,
};

let hasAuth = false;
for (const [key, value] of Object.entries(envVars)) {
  const status = value ? '✓' : '✗';
  const displayValue = value || '(未设置)';
  console.log(`  ${status} ${key}: ${displayValue}`);
  
  if ((key === 'API_PASSWORD' || key === 'JWT_TOKEN') && value) {
    hasAuth = true;
  }
}

console.log('\n' + '='.repeat(60));
if (hasAuth) {
  console.log('✓ 认证信息已配置');
} else {
  console.log('✗ 未找到认证信息 (API_PASSWORD 或 JWT_TOKEN)');
  console.log('\n建议:');
  console.log('1. 确保 .env 文件在以下位置之一:');
  for (const envPath of envPaths) {
    console.log(`   - ${envPath}`);
  }
  console.log('\n2. .env 文件内容示例:');
  console.log('   API_USERNAME=admin');
  console.log('   API_PASSWORD=admin123');
  console.log('   # 或者');
  console.log('   JWT_TOKEN=your_jwt_token_here');
  console.log('\n3. 运行以下命令创建管理员用户:');
  console.log('   node scripts/get-auth-info.js --create-admin');
  console.log('\n4. 运行以下命令获取 JWT token:');
  console.log('   node scripts/get-auth-info.js --get-token');
}

console.log('='.repeat(60));



