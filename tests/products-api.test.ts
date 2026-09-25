import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '../lib/prisma'
import { GET as getProduct } from '../src/app/api/products/[slug]/route'

// Regression coverage: the product detail page checked `data.success` and
// read `data.product`, but this route returns the product object directly
// on success with no wrapper -- every product page showed "Product Not
// Found" regardless of whether the product existed.

describe('GET /api/products/[slug]', () => {
  let slug: string

  beforeAll(async () => {
    const product = await prisma.product.create({
      data: {
        name: '__test product',
        slug: `__test-product-${Date.now()}`,
        price: 9.99,
        images: JSON.stringify(['https://example.com/a.png']),
        tags: JSON.stringify(['test']),
        status: 'active'
      }
    })
    slug = product.slug
  })

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug } })
    await prisma.$disconnect()
  })

  it('returns the product directly (no {success, product} wrapper) for a real slug', async () => {
    const res = await getProduct(
      new NextRequest(new URL(`https://example.com/api/products/${slug}`)),
      { params: Promise.resolve({ slug }) }
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    // This is the exact shape the frontend's `if (response.ok) setProduct(data)`
    // depends on -- no `success` field, no nested `product` field.
    expect(data.success).toBeUndefined()
    expect(data.product).toBeUndefined()
    expect(data.slug).toBe(slug)
    expect(data.name).toBe('__test product')
    expect(Array.isArray(data.variants)).toBe(true)
  })

  it('returns a 404 with an error field for a nonexistent slug', async () => {
    const res = await getProduct(
      new NextRequest(new URL('https://example.com/api/products/does-not-exist')),
      { params: Promise.resolve({ slug: 'does-not-exist' }) }
    )
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBeDefined()
  })
})
