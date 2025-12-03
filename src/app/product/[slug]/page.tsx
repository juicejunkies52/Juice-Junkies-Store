'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  Heart,
  Star,
  ArrowLeft,
  Plus,
  Minus,
  Truck,
  Shield,
  RotateCcw
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCart } from '../../../contexts/CartContext'
import ProductImage from '../../../components/ProductImage'

interface Product {
  id: string
  name: string
  slug: string
  description?: string
  price: number
  compareAtPrice?: number
  images: string[]
  tags: string[]
  inventoryQty: number
  status: string
  fulfillmentType: string
  category?: {
    name: string
    slug: string
  }
}

export default function ProductPage() {
  const { slug } = useParams()
  const { addItem, setCartOpen } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  useEffect(() => {
    if (slug) {
      fetchProduct()
    }
  }, [slug])

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${slug}`)
      const data = await response.json()
      if (data.success) {
        setProduct(data.product)
      }
    } catch (error) {
      console.error('Failed to fetch product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = () => {
    if (!product) return

    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      quantity: quantity,
      image: product.images[0],
      maxQuantity: product.inventoryQty
    })

    setCartOpen(true)
  }

  const discount = product?.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0

  const isLowStock = product && product.inventoryQty <= 10
  const isOutOfStock = product && product.inventoryQty === 0

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Product Not Found</h1>
          <Link
            href="/"
            className="text-accent hover:text-accent/80 transition-colors"
          >
            Return to Store
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-green-900/10" />
      </div>

      {/* Header */}
      <motion.header
        className="relative z-10 border-b border-gray-800 bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">{product.name}</h1>
              {product.category && (
                <p className="text-gray-400 text-sm">{product.category.name}</p>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {/* Main Image */}
            <div className="aspect-square bg-gray-900/50 rounded-xl overflow-hidden relative">
              <ProductImage
                src={product.images[selectedImageIndex]}
                alt={product.name}
                productName={product.name}
                className="w-full h-full object-cover"
              />

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {discount > 0 && (
                  <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded">
                    -{discount}%
                  </span>
                )}
                {isLowStock && !isOutOfStock && (
                  <span className="px-3 py-1 bg-yellow-500 text-black text-sm font-bold rounded">
                    Low Stock
                  </span>
                )}
                {isOutOfStock && (
                  <span className="px-3 py-1 bg-gray-500 text-white text-sm font-bold rounded">
                    Sold Out
                  </span>
                )}
              </div>
            </div>

            {/* Image Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-4 overflow-x-auto">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      index === selectedImageIndex ? 'border-accent' : 'border-gray-700'
                    }`}
                  >
                    <ProductImage
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      productName={product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Product Details */}
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Product Info */}
            <div>
              <h1 className="text-4xl font-bold text-white mb-4">{product.name}</h1>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {product.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-sm bg-gray-800/50 text-gray-300 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Price */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-4xl font-bold text-white">
                  ${product.price.toFixed(2)}
                </span>
                {product.compareAtPrice && (
                  <span className="text-xl text-gray-400 line-through">
                    ${product.compareAtPrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                  <p className="text-gray-300 leading-relaxed">{product.description}</p>
                </div>
              )}
            </div>

            {/* Quantity Selector */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Quantity
              </label>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4 text-gray-400" />
                </button>
                <span className="w-16 text-center text-white font-semibold text-lg">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(product.inventoryQty, quantity + 1))}
                  className="p-2 border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
                  disabled={quantity >= product.inventoryQty}
                >
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Stock Status */}
              <div className="mb-6">
                {isOutOfStock ? (
                  <p className="text-red-400 text-sm">Out of stock</p>
                ) : isLowStock ? (
                  <p className="text-yellow-400 text-sm">Only {product.inventoryQty} left!</p>
                ) : (
                  <p className="text-green-400 text-sm">In stock ({product.inventoryQty} available)</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <motion.button
                onClick={handleAddToCart}
                className={`w-full py-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-3 ${
                  isOutOfStock
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white hover:shadow-lg'
                }`}
                whileHover={!isOutOfStock ? { scale: 1.02 } : {}}
                whileTap={!isOutOfStock ? { scale: 0.98 } : {}}
                disabled={!!isOutOfStock}
              >
                <ShoppingCart className="w-5 h-5" />
                {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
              </motion.button>

              <button className="w-full py-3 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                <Heart className="w-4 h-4" />
                Add to Wishlist
              </button>
            </div>

            {/* Features */}
            <div className="space-y-4 pt-6 border-t border-gray-800">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-white font-medium">Free Shipping</p>
                  <p className="text-gray-400 text-sm">On orders over $50</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-white font-medium">Secure Payment</p>
                  <p className="text-gray-400 text-sm">Your information is protected</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-white font-medium">Easy Returns</p>
                  <p className="text-gray-400 text-sm">30-day return policy</p>
                </div>
              </div>
            </div>

            {/* Fulfillment Type Info */}
            {product.fulfillmentType === 'printful' && (
              <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                  <span className="text-cyan-400 font-medium">Print-on-Demand</span>
                </div>
                <p className="text-cyan-300 text-sm mt-1">
                  This item is made to order. Please allow 3-5 business days for production before shipping.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}