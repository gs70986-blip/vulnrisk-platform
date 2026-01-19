const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const email = process.argv[4] || 'admin@example.com';

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      console.log('User already exists. Updating to admin role...');
      const updated = await prisma.user.update({
        where: { username },
        data: {
          role: 'admin',
          password: hashedPassword, // Update password too
        },
      });
      console.log('Admin user updated successfully:');
      console.log(`Username: ${updated.username}`);
      console.log(`Email: ${updated.email || 'N/A'}`);
      console.log(`Role: ${updated.role}`);
      return;
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'admin',
      },
    });

    console.log('Admin user created successfully:');
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email || 'N/A'}`);
    console.log(`Role: ${user.role}`);
    console.log(`\nYou can now login with:`);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
  } catch (error) {
    if (error.code === 'P2002') {
      console.error('Error: User with this username or email already exists');
    } else {
      console.error('Error creating admin:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();








