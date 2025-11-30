import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const limit = parseInt(searchParams.get('limit') || '8')

  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        ...(category && {
          category: {
            slug: category
          }
        })
      },
      include: {
        category: true,
        variants: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    const formattedProducts = products.map(product => ({
      ...product,
      images: JSON.parse(product.images),
      tags: JSON.parse(product.tags)
    }))

    return NextResponse.json(formattedProducts)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}