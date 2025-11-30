import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { z } from 'zod'

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  compareAtPrice: z.number().min(0).optional(),
  inventoryQty: z.number().int().min(0).default(0),
  sku: z.string().optional(),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  images: z.array(z.string()).default([])
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = productSchema.parse(body)

    // Generate slug from name
    const baseSlug = generateSlug(data.name)
    let slug = baseSlug
    let counter = 0

    // Ensure slug is unique
    while (await prisma.product.findUnique({ where: { slug } })) {
      counter++
      slug = `${baseSlug}-${counter}`
    }

    // Check if SKU already exists (if provided)
    if (data.sku) {
      const existingSku = await prisma.product.findUnique({
        where: { sku: data.sku }
      })
      if (existingSku) {
        return NextResponse.json(
          { error: 'SKU already exists' },
          { status: 409 }
        )
      }
    }

    // Verify category exists (if provided)
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId }
      })
      if (!category) {
        return NextResponse.json(
          { error: 'Invalid category ID' },
          { status: 400 }
        )
      }
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: slug,
        description: data.description,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        inventoryQty: data.inventoryQty,
        sku: data.sku,
        status: data.status,
        categoryId: data.categoryId,
        tags: JSON.stringify(data.tags),
        images: JSON.stringify(data.images)
      },
      include: {
        category: true
      }
    })

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        tags: JSON.parse(product.tags),
        images: JSON.parse(product.images)
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Product creation error:', error)
    console.error('Error details:', error.message)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const formattedProducts = products.map(product => ({
      ...product,
      tags: JSON.parse(product.tags),
      images: JSON.parse(product.images)
    }))

    return NextResponse.json({
      success: true,
      products: formattedProducts
    })

  } catch (error) {
    console.error('Products fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}