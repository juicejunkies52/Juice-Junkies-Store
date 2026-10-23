'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import ProductCard from './ProductCard'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice?: number
  images: string[]
  tags: string[]
  inventoryQty: number
  preOrderMode?: boolean
  preOrderDeposit?: number | null
  category?: {
    name: string
    slug: string
  }
}

// Clothing reads as one visual group on the homepage instead of being
// scattered among accessories/home goods; anything else keeps arriving in
// whatever order the API already gave it.
const CLOTHING_SLUGS = new Set(['hoodies', 't-shirts', 'baby-kids'])

function groupClothingFirst(products: Product[]) {
  const clothing = products.filter((p) => p.category && CLOTHING_SLUGS.has(p.category.slug))
  const rest = products.filter((p) => !p.category || !CLOTHING_SLUGS.has(p.category.slug))
  return [...clothing, ...rest]
}

export default function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products?featured=true&limit=12')
        if (response.ok) {
          const data = await response.json()
          if (data.length > 0) {
            setProducts(groupClothingFirst(data))
          } else {
            // Nothing's been marked featured yet in admin -- fall back to
            // the full catalog so the section isn't empty.
            const fallback = await fetch('/api/products?limit=12')
            if (fallback.ok) setProducts(groupClothingFirst(await fallback.json()))
          }
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  if (loading) {
    return (
      <section id="collections" className="relative z-40 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            className="text-4xl md:text-6xl font-bold text-center mb-16 text-gradient font-mono"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            JUICE JUNKIES LAUNCH COLLECTION
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-gray-800/50 animate-pulse rounded-lg"
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="collections" className="relative z-40 py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.h2
          className="text-4xl md:text-6xl font-bold text-center mb-16 text-gradient font-mono"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          JUICE JUNKIES LAUNCH COLLECTION
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
            />
          ))}
        </div>

        {/* View All Products Button */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <motion.a
            href="/shop"
            className="btn-secondary px-8 py-4 text-lg inline-block"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            View All Products
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}