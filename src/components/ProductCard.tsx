'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, Heart, Star } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import ProductImage from './ProductImage'
import { useCart } from '@/contexts/CartContext'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice?: number
  images: string[]
  tags: string[]
  inventoryQty: number
  category?: {
    name: string
    slug: string
  }
}

interface ProductCardProps {
  product: Product
  index?: number
  viewMode?: 'grid' | 'list'
}

export default function ProductCard({ product, index = 0, viewMode = 'grid' }: ProductCardProps) {
  const { addItem, setCartOpen } = useCart()

  const discount = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0

  const isLowStock = product.inventoryQty <= 10
  const isOutOfStock = product.inventoryQty === 0

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent navigation if clicking on the card

    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      quantity: 1,
      image: product.images[0],
      maxQuantity: product.inventoryQty
    })

    // Briefly open cart to show item was added
    setCartOpen(true)
  }

  return (
    <motion.div
      className="group relative bg-black/20 backdrop-blur-sm rounded-lg border border-gray-800 hover:border-accent/50 transition-all duration-300 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{
        y: -5,
        boxShadow: "0 20px 40px rgba(106, 13, 173, 0.3)"
      }}
    >
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-900/50">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />

        <ProductImage
          src={product.images[0]}
          alt={product.name}
          productName={product.name}
          className="w-full h-full object-cover"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
          {discount > 0 && (
            <motion.span
              className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              -{discount}%
            </motion.span>
          )}
          {isLowStock && !isOutOfStock && (
            <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded">
              Low Stock
            </span>
          )}
          {isOutOfStock && (
            <span className="px-2 py-1 bg-gray-500 text-white text-xs font-bold rounded">
              Sold Out
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <motion.button
            className="p-2 bg-black/50 backdrop-blur-sm rounded-full text-white hover:text-accent hover:bg-black/70 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Heart className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Category */}
        {product.category && (
          <span className="text-xs text-accent/80 uppercase tracking-wide font-semibold">
            {product.category.name}
          </span>
        )}

        {/* Product Name */}
        <Link href={`/product/${product.slug}`}>
          <h3 className="text-white font-bold text-lg mt-1 mb-2 group-hover:text-accent transition-colors line-clamp-2 cursor-pointer hover:underline">
            {product.name}
          </h3>
        </Link>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {product.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-gray-800/50 text-gray-300 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl font-bold text-white">
            ${product.price.toFixed(2)}
          </span>
          {product.compareAtPrice && (
            <span className="text-sm text-gray-400 line-through">
              ${product.compareAtPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <motion.button
          onClick={handleAddToCart}
          className={`w-full py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
            isOutOfStock
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white hover:shadow-lg'
          }`}
          whileHover={!isOutOfStock ? { scale: 1.02 } : {}}
          whileTap={!isOutOfStock ? { scale: 0.98 } : {}}
          disabled={isOutOfStock}
        >
          <ShoppingCart className="w-4 h-4" />
          {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
        </motion.button>

        {/* Stock indicator */}
        {!isOutOfStock && isLowStock && (
          <p className="text-xs text-yellow-400 mt-2 text-center">
            Only {product.inventoryQty} left!
          </p>
        )}
      </div>

      {/* Animated border effect */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent via-primary to-accent opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10 blur-md" />
    </motion.div>
  )
}