'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import Link from 'next/link'

export default function CartSidebar() {
  const { state, removeItem, updateQuantity, setCartOpen } = useCart()

  return (
    <AnimatePresence>
      {state.isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
          />

          {/* Cart Sidebar */}
          <motion.div
            className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-gray-800 z-50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-semibold text-white">
                  Your Cart ({state.itemCount})
                </h2>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {state.items.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Your cart is empty</h3>
                  <p className="text-gray-400 mb-6">Add some items to get started</p>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="px-6 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {state.items.map((item) => (
                    <motion.div
                      key={item.id}
                      className="flex items-center gap-4 p-4 bg-black/20 rounded-lg border border-gray-800"
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{item.name}</h3>
                        {item.variantSize && (
                          <p className="text-gray-400 text-sm">Size: {item.variantSize}</p>
                        )}
                        <p className="text-accent font-semibold">${item.price.toFixed(2)}</p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="w-4 h-4 text-gray-400" />
                        </button>
                        <span className="text-white font-medium w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          disabled={item.quantity >= item.maxQuantity}
                        >
                          <Plus className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 hover:bg-red-600/20 text-red-400 hover:text-red-300 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {state.items.length > 0 && (
              <div className="border-t border-gray-800 p-6">
                {/* Total */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-medium text-white">Total</span>
                  <span className="text-2xl font-bold text-accent">${state.total.toFixed(2)}</span>
                </div>

                {/* Checkout Button */}
                <Link href="/checkout" onClick={() => setCartOpen(false)}>
                  <motion.button
                    className="w-full py-3 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Proceed to Checkout
                  </motion.button>
                </Link>

                {/* Continue Shopping */}
                <button
                  onClick={() => setCartOpen(false)}
                  className="w-full mt-3 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}