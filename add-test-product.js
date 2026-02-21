const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function addTestProduct() {
  try {
    // Get accessories category
    const accessories = await prisma.category.findUnique({
      where: { slug: "accessories" }
    })

    // Create the $1 test product
    const testProduct = await prisma.product.create({
      data: {
        name: "Test Sticker - $1 Payment Test",
        slug: "test-sticker-1-dollar",
        description: "Single test sticker for payment testing only. $1.00 test item.",
        price: 1.00,
        images: JSON.stringify(["/products/test-sticker.jpg"]),
        inventoryQty: 999,
        sku: "TEST-STICKER-1",
        tags: JSON.stringify(["test", "sticker", "payment-test"]),
        categoryId: accessories?.id,
        status: "active"
      }
    })

    console.log('✅ Test product added:', testProduct.name)
    console.log('Price: $' + testProduct.price)

  } catch (error) {
    console.error('Error adding test product:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addTestProduct()