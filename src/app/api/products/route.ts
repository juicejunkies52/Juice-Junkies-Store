import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const featured = searchParams.get('featured') === 'true'
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam) : undefined

  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        ...(category && {
          category: {
            slug: category
          }
        }),
        ...(featured && { featured: true })
      },
      include: {
        category: true,
        variants: true
      },
      // Featured picks respect the admin-set display order; everything
      // else falls back to newest-first.
      orderBy: featured ? [{ featuredOrder: 'asc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
      ...(limit && { take: limit })
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