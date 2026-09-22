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

// Printful gives each variant (color/angle) its own preview image rather than
// one image per product. Collect every distinct preview across all variants
// so the product page can show a real gallery instead of a single photo.
function getPreviewImages(productDetails: any, fallback?: string): string[] {
  const urls = new Set<string>()

  for (const variant of productDetails.sync_variants || []) {
    for (const file of variant.files || []) {
      if (file.type === 'preview' && file.preview_url) {
        urls.add(file.preview_url)
      }
    }
  }

  if (urls.size === 0 && fallback) {
    urls.add(fallback)
  }

  return Array.from(urls)
}

// Upsert one Variant row per Printful sync_variant (color/size combo), keyed
// by Printful's own variant external_id so fulfillment can submit orders
// against the exact variant the customer picked, not just the base product.
async function syncVariants(productId: string, productDetails: any) {
  for (const sv of productDetails.sync_variants || []) {
    const price = parseFloat(sv.retail_price)
    const inventoryQty = sv.availability_status === 'active' ? 999 : 0

    await prisma.variant.upsert({
      where: { printfulExtId: sv.external_id },
      update: {
        productId,
        size: sv.size || null,
        color: sv.color || null,
        price: Number.isNaN(price) ? null : price,
        sku: sv.sku || null,
        inventoryQty,
        updatedAt: new Date()
      },
      create: {
        productId,
        size: sv.size || null,
        color: sv.color || null,
        price: Number.isNaN(price) ? null : price,
        sku: sv.sku || null,
        printfulExtId: sv.external_id,
        inventoryQty
      }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get all products from Printful
    const printfulProducts = await printfulService.getProducts()

    const syncResults = []

    for (const printfulProduct of printfulProducts) {
      try {
        // Get detailed product info with variants. Printful's product-detail
        // endpoint expects the numeric sync product id, not our external_id.
        const productDetails = await printfulService.getProduct(printfulProduct.id.toString())

        // Check if product already exists in our database
        const existingProduct = await prisma.product.findFirst({
          where: { printfulExtId: printfulProduct.external_id }
        })

        const previewImages = getPreviewImages(productDetails, printfulProduct.thumbnail_url)

        if (existingProduct) {
          // Update existing product
          const updatedProduct = await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              name: printfulProduct.name,
              images: JSON.stringify(previewImages),
              mockupImages: JSON.stringify(previewImages),
              printfulId: printfulProduct.id.toString(),
              fulfillmentType: 'printful',
              status: printfulProduct.is_ignored ? 'archived' : 'active',
              updatedAt: new Date()
            }
          })

          await syncVariants(updatedProduct.id, productDetails)

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
              images: JSON.stringify(previewImages),
              tags: JSON.stringify(['printful', 'print-on-demand']),
              status: printfulProduct.is_ignored ? 'archived' : 'active',
              fulfillmentType: 'printful',
              printfulId: printfulProduct.id.toString(),
              printfulExtId: printfulProduct.external_id,
              mockupImages: JSON.stringify(previewImages),
              inventoryQty: 999, // Print-on-demand has unlimited inventory
            }
          })

          await syncVariants(newProduct.id, productDetails)

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