import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { printfulService } from '../../../../../../lib/printful'
import { z } from 'zod'

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(request: NextRequest) {
  try {
    // Get all products from Printful
    const printfulProducts = await printfulService.getProducts()

    const syncResults = []

    for (const printfulProduct of printfulProducts) {
      try {
        // Get detailed product info with variants
        const productDetails = await printfulService.getProduct(printfulProduct.external_id)

        // Check if product already exists in our database
        const existingProduct = await prisma.product.findFirst({
          where: { printfulExtId: printfulProduct.external_id }
        })

        if (existingProduct) {
          // Update existing product
          const updatedProduct = await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              name: printfulProduct.name,
              images: JSON.stringify([printfulProduct.thumbnail]),
              mockupImages: JSON.stringify([productDetails.sync_product.thumbnail_url]),
              printfulId: printfulProduct.id.toString(),
              fulfillmentType: 'printful',
              status: printfulProduct.sync_product.is_ignored ? 'archived' : 'active',
              updatedAt: new Date()
            }
          })

          syncResults.push({
            action: 'updated',
            product: updatedProduct,
            printfulProduct: printfulProduct
          })
        } else {
          // Create new product
          const baseSlug = generateSlug(printfulProduct.name)
          let slug = baseSlug
          let counter = 0

          // Ensure slug is unique
          while (await prisma.product.findUnique({ where: { slug } })) {
            counter++
            slug = `${baseSlug}-${counter}`
          }

          // Calculate price from variants (use first variant price if available)
          const firstVariant = productDetails.sync_variants?.[0]
          const price = firstVariant ? parseFloat(firstVariant.retail_price) : 25.00

          const newProduct = await prisma.product.create({
            data: {
              name: printfulProduct.name,
              slug: slug,
              description: `High-quality ${printfulProduct.name} - Print-on-demand`,
              price: price,
              images: JSON.stringify([printfulProduct.thumbnail]),
              tags: JSON.stringify(['printful', 'print-on-demand']),
              status: printfulProduct.sync_product.is_ignored ? 'archived' : 'active',
              fulfillmentType: 'printful',
              printfulId: printfulProduct.id.toString(),
              printfulExtId: printfulProduct.external_id,
              mockupImages: JSON.stringify([productDetails.sync_product.thumbnail_url]),
              inventoryQty: 999, // Print-on-demand has unlimited inventory
            }
          })

          syncResults.push({
            action: 'created',
            product: newProduct,
            printfulProduct: printfulProduct
          })
        }
      } catch (productError) {
        console.error(`Error syncing product ${printfulProduct.external_id}:`, productError)
        syncResults.push({
          action: 'error',
          printfulProduct: printfulProduct,
          error: productError instanceof Error ? productError.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncResults.length} products from Printful`,
      results: syncResults,
      summary: {
        total: syncResults.length,
        created: syncResults.filter(r => r.action === 'created').length,
        updated: syncResults.filter(r => r.action === 'updated').length,
        errors: syncResults.filter(r => r.action === 'error').length
      }
    })

  } catch (error) {
    console.error('Printful sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync products from Printful', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Get sync status
export async function GET() {
  try {
    const printfulProducts = await prisma.product.findMany({
      where: { fulfillmentType: 'printful' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        printfulId: true,
        printfulExtId: true,
        createdAt: true,
        updatedAt: true
      }
    })

    const totalProducts = await prisma.product.count()
    const printfulCount = printfulProducts.length

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        printfulProducts: printfulCount,
        manualProducts: totalProducts - printfulCount,
        lastSync: printfulProducts.length > 0
          ? Math.max(...printfulProducts.map(p => new Date(p.updatedAt).getTime()))
          : null
      },
      products: printfulProducts
    })

  } catch (error) {
    console.error('Printful status error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}