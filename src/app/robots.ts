import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://juicejunkies.shop'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/account', '/checkout', '/order', '/preorder/pay']
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  }
}
