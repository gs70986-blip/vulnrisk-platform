# 密码管理指南

## 重要说明

**密码是使用bcrypt进行单向哈希加密的，无法解密查看原始密码。**

这是安全设计的一部分：
- bcrypt是单向哈希函数，设计上就是不可逆的
- 即使数据库被泄露，攻击者也无法直接获取原始密码
- 只能通过暴力破解（需要大量时间和计算资源）

## 解决方案

### 方法1: 重置密码（推荐）

如果你忘记了密码，可以创建一个脚本来重置密码：

#### 创建重置密码脚本

创建文件 `backend-node/scripts/reset-password.js`:

```javascript
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPassword(username, newPassword) {
  try {
    console.log(`正在重置用户 ${username} 的密码...`);
    
    // 生成密码哈希
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新数据库
    const user = await prisma.user.update({
      where: { username },
      data: { password: hashedPassword }
    });
    
    console.log(`密码已重置成功！`);
    console.log(`用户名: ${user.username}`);
    console.log(`新密码: ${newPassword}`);
    console.log(`\n请妥善保管新密码！`);
    
  } catch (error) {
    if (error.code === 'P2025') {
      console.error(`错误: 用户 ${username} 不存在`);
    } else {
      console.error('错误:', error.message);
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
    process.exit(1);
  }
  
  const username = args[0];
  const newPassword = args[1];
  
  await resetPassword(username, newPassword);
}

if (require.main === module) {
  main().catch(console.error);
}
```

#### 使用方法

```powershell
# 在本地运行（需要先设置DATABASE_URL环境变量）
cd backend-node
node scripts/reset-password.js admin newpassword123

# 或在Docker容器中运行
docker-compose exec backend-node node scripts/reset-password.js admin newpassword123
```

### 方法2: 创建新用户

如果无法重置现有用户密码，可以创建新用户：

```powershell
# 使用现有的create-admin脚本
cd backend-node
node scripts/create-admin.js newuser newpassword
```

### 方法3: 直接通过SQL更新（不推荐，仅用于开发环境）

⚠️ **警告**: 仅用于开发环境，生产环境请使用方法1或2。

```powershell
# 生成密码哈希（需要Node.js）
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('yourpassword', 10).then(hash => console.log(hash))"

# 然后使用SQL更新
docker-compose exec postgres psql -U postgres -d vulnrisk -c "UPDATE users SET password = '<生成的哈希值>' WHERE username = 'admin';"
```

### 方法4: 查看用户信息（不包括密码）

你可以查看用户的其他信息，但密码字段显示的是哈希值：

```powershell
# 查看所有用户
docker-compose exec postgres psql -U postgres -d vulnrisk -c "SELECT id, username, email, role, \"createdAt\" FROM users;"

# 查看特定用户
docker-compose exec postgres psql -U postgres -d vulnrisk -c "SELECT id, username, email, role FROM users WHERE username = 'admin';"
```

## 密码验证

如果你想验证一个密码是否正确，可以使用以下方法：

### 通过登录API验证

```powershell
# 尝试登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}'
```

如果密码正确，会返回token；如果错误，会返回错误信息。

### 创建验证脚本

创建 `backend-node/scripts/verify-password.js`:

```javascript
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function verifyPassword(username, password) {
  try {
    const user = await prisma.user.findUnique({
      where: { username }
    });
    
    if (!user) {
      console.error(`用户 ${username} 不存在`);
      process.exit(1);
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    
    if (isValid) {
      console.log(`✓ 密码正确`);
    } else {
      console.log(`✗ 密码错误`);
    }
    
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法: node scripts/verify-password.js <username> <password>');
  process.exit(1);
}

verifyPassword(args[0], args[1]);
```

## 安全建议

1. **不要尝试"解密"密码**: 这是不可能的，也是不安全的
2. **使用强密码**: 至少8个字符，包含大小写字母、数字和特殊字符
3. **定期更换密码**: 特别是在生产环境中
4. **使用密码管理器**: 保存和管理密码
5. **不要在代码中硬编码密码**: 使用环境变量或配置文件

## 常见问题

### Q: 为什么不能查看原始密码？
A: 这是安全设计。如果密码可以被查看，那么数据库泄露就会导致所有密码暴露。使用单向哈希，即使数据库被泄露，攻击者也需要暴力破解。

### Q: 如果我忘记了密码怎么办？
A: 使用重置密码脚本（方法1）或创建新用户（方法2）。

### Q: 如何知道密码是否正确？
A: 使用登录API或验证脚本（方法4）来验证密码。

### Q: 可以在数据库中直接修改密码吗？
A: 可以，但需要先生成bcrypt哈希值。不建议直接修改，使用脚本更安全。

## 快速命令参考

```powershell
# 重置密码
cd backend-node
node scripts/reset-password.js <username> <new_password>

# 创建新管理员
node scripts/create-admin.js <username> <password>

# 查看用户列表
docker-compose exec postgres psql -U postgres -d vulnrisk -c "SELECT username, email, role FROM users;"

# 测试登录
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"yourpassword"}'
```





