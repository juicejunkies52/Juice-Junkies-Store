const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

async function setupProduction() {
  const prisma = new PrismaClient()

  try {
    console.log('🚀 Setting up production database...')

    // Create admin user if not exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' }
    })

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@999store.com',
          password: hashedPassword,
          role: 'admin'
        }
      })
      console.log('✅ Admin user created')
    } else {
      console.log('✅ Admin user already exists')
    }

    // Create sample products if none exist
    const productCount = await prisma.product.count()
    if (productCount === 0) {
      console.log('📦 Creating sample products...')

      await prisma.product.createMany({
        data: [
          {
            name: "Legends Never Die T-Shirt",
            slug: "legends-never-die-t-shirt",
            description: "Official JUICE WRLD merchandise featuring iconic album artwork",
            price: 34.99,
            compareAtPrice: 49.99,
            images: JSON.stringify([
              "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300",
              "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=300"
            ]),
            inventoryQty: 100,
            sku: "LND-TSHIRT-BLACK-M",
            tags: JSON.stringify(["tshirt", "legends", "album", "black"]),
            status: "active",
            fulfillmentType: "manual"
          },
          {
            name: "999 Club Hoodie",
            slug: "999-club-hoodie",
            description: "Premium 999 Club hoodie for true fans",
            price: 89.99,
            images: JSON.stringify([
              "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300"
            ]),
            inventoryQty: 50,
            tags: JSON.stringify(["hoodie", "999", "club"]),
            status: "active",
            fulfillmentType: "manual"
          }
        ]
      })
      console.log('✅ Sample products created')
    }

    console.log('🎉 Production setup complete!')
  } catch (error) {
    console.error('❌ Production setup failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupProduction()