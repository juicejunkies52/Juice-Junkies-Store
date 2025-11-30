'use client'

import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'

export default function CartIcon() {
  const { state, toggleCart } = useCart()

  return (
    <motion.button
      onClick={toggleCart}
      className="relative p-2 text-accent hover:text-white cursor-pointer transition-colors"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <ShoppingBag className="w-6 h-6" />

      {state.itemCount > 0 && (
        <motion.div
          className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-purple-500 to-green-400 rounded-full flex items-center justify-center text-white text-xs font-bold"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          key={state.itemCount} // Re-animate when count changes
        >
          <motion.span
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {state.itemCount > 99 ? '99+' : state.itemCount}
          </motion.span>
        </motion.div>
      )}
    </motion.button>
  )
}