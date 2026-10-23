import { MetadataRoute } from 'next'
import { prisma } from '../../lib/prisma'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://juicejunkies.shop'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    select: { slug: true, updatedAt: true }
  })

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/lyrics`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/returns`, changeFrequency: 'yearly', priority: 0.2 }
  ]

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}/product/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8
  }))

  return [...staticRoutes, ...productRoutes]
}
