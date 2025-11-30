'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import ProductImage from './ProductImage'

export default function CartDrawer() {
  const router = useRouter()
  const { state, removeItem, updateQuantity, toggleCart, setCartOpen } = useCart()

  const shippingThreshold = 75
  const shippingProgress = Math.min((state.total / shippingThreshold) * 100, 100)
  const remainingForFreeShipping = Math.max(shippingThreshold - state.total, 0)

  return (
    <AnimatePresence>
      {state.isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
          />

          {/* Cart Drawer */}
          <motion.div
            className="fixed top-0 right-0 h-full w-full max-w-md bg-black/90 backdrop-blur-md border-l border-gray-800 z-50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-6 h-6 text-accent" />
                <h2 className="text-xl font-bold text-white">
                  Cart ({state.itemCount})
                </h2>
              </div>
              <motion.button
                onClick={() => setCartOpen(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Free Shipping Progress */}
            {state.total > 0 && state.total < shippingThreshold && (
              <div className="p-6 bg-gradient-to-r from-purple-900/20 to-green-400/20">
                <div className="text-sm text-gray-300 mb-2">
                  ${remainingForFreeShipping.toFixed(2)} away from free shipping!
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <motion.div
                    className="h-2 bg-gradient-to-r from-purple-500 to-green-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${shippingProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {state.total >= shippingThreshold && (
              <div className="p-6 bg-gradient-to-r from-green-400/20 to-green-600/20">
                <div className="text-sm text-green-400 font-semibold">
                  🎉 You qualify for free shipping!
                </div>
              </div>
            )}

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto">
              {state.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <motion.div
                    className="text-gray-500 text-6xl mb-4"
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                      scale: [0.95, 1.05, 0.95]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    🛒
                  </motion.div>
                  <p className="text-gray-400 text-lg mb-2">Your cart is empty</p>
                  <p className="text-gray-500 text-sm">Add some legendary merch to get started!</p>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {state.items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      className="flex gap-4 bg-gray-900/50 rounded-lg p-4 border border-gray-800"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {/* Product Image */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        <ProductImage
                          src={item.image}
                          alt={item.name}
                          productName={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm mb-1 truncate">
                          {item.name}
                        </h3>
                        {item.variantSize && (
                          <p className="text-gray-400 text-xs mb-1">Size: {item.variantSize}</p>
                        )}
                        <p className="text-accent font-bold text-sm">
                          ${item.price.toFixed(2)}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <motion.button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-white hover:border-accent transition-colors"
                            whileTap={{ scale: 0.95 }}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="w-3 h-3" />
                          </motion.button>

                          <span className="w-8 text-center text-white text-sm font-semibold">
                            {item.quantity}
                          </span>

                          <motion.button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-white hover:border-accent transition-colors"
                            whileTap={{ scale: 0.95 }}
                            disabled={item.quantity >= item.maxQuantity}
                          >
                            <Plus className="w-3 h-3" />
                          </motion.button>

                          <motion.button
                            onClick={() => removeItem(item.id)}
                            className="ml-auto p-1 text-gray-400 hover:text-red-400 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>

                        {item.quantity >= item.maxQuantity && (
                          <p className="text-yellow-400 text-xs mt-1">Max quantity reached</p>
                        )}
                      </div>

                      {/* Item Total */}
                      <div className="text-right">
                        <p className="text-white font-bold">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with Total and Checkout */}
            {state.items.length > 0 && (
              <div className="p-6 border-t border-gray-800 bg-black/50">
                <div className="space-y-4">
                  {/* Subtotal */}
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-300">Subtotal</span>
                    <span className="text-white font-bold">${state.total.toFixed(2)}</span>
                  </div>

                  {/* Shipping */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Shipping</span>
                    <span className="text-gray-400">
                      {state.total >= shippingThreshold ? 'FREE' : '$9.99'}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between text-xl font-bold border-t border-gray-700 pt-4">
                    <span className="text-white">Total</span>
                    <span className="text-accent">
                      ${(state.total + (state.total >= shippingThreshold ? 0 : 9.99)).toFixed(2)}
                    </span>
                  </div>

                  {/* Checkout Button */}
                  <motion.button
                    onClick={() => {
                      setCartOpen(false)
                      router.push('/checkout')
                    }}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white font-semibold rounded-lg transition-all duration-300 neon-glow"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Checkout
                  </motion.button>

                  <p className="text-xs text-gray-400 text-center">
                    Secure checkout powered by Stripe
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}