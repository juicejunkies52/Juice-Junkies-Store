import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create categories
  const categories = [
    {
      name: "999 Club",
      slug: "999-club",
      description: "Exclusive Juice WRLD 999 Club merchandise",
      image: "/categories/999-club.jpg"
    },
    {
      name: "Memorial Collection",
      slug: "memorial",
      description: "Commemorative items honoring Juice WRLD's legacy",
      image: "/categories/memorial.jpg"
    },
    {
      name: "Hoodies & Sweatshirts",
      slug: "hoodies",
      description: "Premium hoodies and sweatshirts",
      image: "/categories/hoodies.jpg"
    },
    {
      name: "T-Shirts",
      slug: "tshirts",
      description: "Official Juice WRLD t-shirts",
      image: "/categories/tshirts.jpg"
    },
    {
      name: "Accessories",
      slug: "accessories",
      description: "Hats, pins, stickers and more",
      image: "/categories/accessories.jpg"
    },
    {
      name: "Limited Drops",
      slug: "limited",
      description: "Exclusive limited edition releases",
      image: "/categories/limited.jpg"
    }
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category
    })
  }

  // Get category references
  const club999 = await prisma.category.findUnique({ where: { slug: "999-club" } })
  const memorial = await prisma.category.findUnique({ where: { slug: "memorial" } })
  const hoodies = await prisma.category.findUnique({ where: { slug: "hoodies" } })
  const tshirts = await prisma.category.findUnique({ where: { slug: "tshirts" } })
  const accessories = await prisma.category.findUnique({ where: { slug: "accessories" } })
  const limited = await prisma.category.findUnique({ where: { slug: "limited" } })

  // Create products
  const products = [
    {
      name: "999 Forever Hoodie",
      slug: "999-forever-hoodie",
      description: "Premium heavyweight hoodie featuring the iconic 999 design with butterfly graphics. Made from 100% cotton fleece.",
      price: 79.99,
      compareAtPrice: 99.99,
      images: JSON.stringify([
        "/products/999-hoodie-1.jpg",
        "/products/999-hoodie-2.jpg",
        "/products/999-hoodie-3.jpg"
      ]),
      inventoryQty: 50,
      sku: "JW-999-HOODIE",
      tags: JSON.stringify(["999", "hoodie", "classic", "bestseller"]),
      categoryId: club999?.id
    },
    {
      name: "Legends Never Die T-Shirt",
      slug: "legends-never-die-tee",
      description: "Commemorative t-shirt with album artwork and 'Legends Never Die' text. Soft cotton blend.",
      price: 34.99,
      compareAtPrice: 39.99,
      images: JSON.stringify([
        "/products/legends-tee-1.jpg",
        "/products/legends-tee-2.jpg"
      ]),
      inventoryQty: 75,
      sku: "JW-LND-TEE",
      tags: JSON.stringify(["legends never die", "tshirt", "album", "memorial"]),
      categoryId: memorial?.id
    },
    {
      name: "Juice WRLD Butterfly Hoodie",
      slug: "butterfly-hoodie",
      description: "Black hoodie with vibrant butterfly design inspired by Juice's favorite imagery. Embroidered details.",
      price: 89.99,
      images: JSON.stringify([
        "/products/butterfly-hoodie-1.jpg",
        "/products/butterfly-hoodie-2.jpg",
        "/products/butterfly-hoodie-3.jpg"
      ]),
      inventoryQty: 30,
      sku: "JW-BUTTERFLY-HOODIE",
      tags: JSON.stringify(["butterfly", "hoodie", "embroidered", "premium"]),
      categoryId: hoodies?.id
    },
    {
      name: "999 Club Snapback",
      slug: "999-club-snapback",
      description: "Premium snapback hat with 999 Club branding. Adjustable fit with flat brim.",
      price: 39.99,
      images: JSON.stringify([
        "/products/999-snapback-1.jpg",
        "/products/999-snapback-2.jpg"
      ]),
      inventoryQty: 100,
      sku: "JW-999-SNAPBACK",
      tags: JSON.stringify(["999", "hat", "snapback", "accessories"]),
      categoryId: accessories?.id
    },
    {
      name: "Righteous Long Sleeve",
      slug: "righteous-long-sleeve",
      description: "Long sleeve shirt featuring 'Righteous' artwork with neon green accents.",
      price: 44.99,
      images: JSON.stringify([
        "/products/righteous-ls-1.jpg",
        "/products/righteous-ls-2.jpg"
      ]),
      inventoryQty: 40,
      sku: "JW-RIGHTEOUS-LS",
      tags: JSON.stringify(["righteous", "long sleeve", "neon", "artwork"]),
      categoryId: tshirts?.id
    },
    {
      name: "Limited Edition Death Race For Love Hoodie",
      slug: "drfl-limited-hoodie",
      description: "Extremely limited hoodie from Death Race For Love era. Only 500 made worldwide.",
      price: 149.99,
      compareAtPrice: 179.99,
      images: JSON.stringify([
        "/products/drfl-hoodie-1.jpg",
        "/products/drfl-hoodie-2.jpg",
        "/products/drfl-hoodie-3.jpg"
      ]),
      inventoryQty: 12,
      sku: "JW-DRFL-LIMITED",
      tags: JSON.stringify(["death race for love", "limited edition", "rare", "collectible"]),
      categoryId: limited?.id
    },
    {
      name: "Juice WRLD Pin Set",
      slug: "juice-pin-set",
      description: "Collectible enamel pin set featuring 5 unique Juice WRLD designs including 999, butterfly, and album covers.",
      price: 24.99,
      images: JSON.stringify([
        "/products/pin-set-1.jpg",
        "/products/pin-set-2.jpg"
      ]),
      inventoryQty: 200,
      sku: "JW-PIN-SET",
      tags: JSON.stringify(["pins", "collectible", "enamel", "set"]),
      categoryId: accessories?.id
    },
    {
      name: "Goodbye & Good Riddance Vintage Tee",
      slug: "gbgr-vintage-tee",
      description: "Vintage-style t-shirt celebrating his debut album. Distressed print with retro fit.",
      price: 39.99,
      images: JSON.stringify([
        "/products/gbgr-tee-1.jpg",
        "/products/gbgr-tee-2.jpg"
      ]),
      inventoryQty: 60,
      sku: "JW-GBGR-VINTAGE",
      tags: JSON.stringify(["goodbye good riddance", "vintage", "album", "retro"]),
      categoryId: tshirts?.id
    }
  ]

  for (const product of products) {
    const createdProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product
    })

    // Add variants for clothing items
    if (product.categoryId === hoodies?.id || product.categoryId === tshirts?.id || product.categoryId === club999?.id) {
      const sizes = ["S", "M", "L", "XL", "XXL"]
      for (const size of sizes) {
        await prisma.variant.create({
          data: {
            productId: createdProduct.id,
            size,
            inventoryQty: Math.floor(Math.random() * 20) + 5,
            sku: `${product.sku}-${size}`
          }
        })
      }
    }
  }

  console.log('✅ Database seeded successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })