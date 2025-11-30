const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.admin.findFirst({
      where: { username: 'admin' }
    })

    if (existingAdmin) {
      console.log('Admin user already exists!')
      console.log('Username: admin')
      console.log('Use your existing password to login')
      return
    }

    // Hash default password
    const hashedPassword = await bcrypt.hash('admin123', 12)

    // Create admin user
    const admin = await prisma.admin.create({
      data: {
        username: 'admin',
        email: 'admin@999store.com',
        password: hashedPassword,
        role: 'super_admin'
      }
    })

    console.log('✅ Admin user created successfully!')
    console.log('📧 Email: admin@999store.com')
    console.log('👤 Username: admin')
    console.log('🔑 Password: admin123')
    console.log('')
    console.log('🌐 Admin Login URL: http://localhost:3000/admin/login')
    console.log('📊 Dashboard URL: http://localhost:3000/admin/dashboard')
    console.log('')
    console.log('⚠️  Please change the default password after first login!')

  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()