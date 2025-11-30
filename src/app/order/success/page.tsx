'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { CheckCircle, Download, Mail, Home } from 'lucide-react'
import AnimatedBackground from '@/components/AnimatedBackground'
import FloatingButterfly from '@/components/FloatingButterfly'

export default function OrderSuccessPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      <FloatingButterfly />

      <div className="relative z-40 min-h-screen flex items-center justify-center px-6">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Success Icon */}
          <motion.div
            className="w-24 h-24 mx-auto mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: 0.2,
              type: "spring",
              stiffness: 200,
              damping: 10
            }}
          >
            <CheckCircle className="w-full h-full text-green-400" />
          </motion.div>

          {/* Success Message */}
          <motion.h1
            className="text-4xl md:text-6xl font-bold text-white mb-6 font-mono"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Order Complete!
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-gray-300 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Thank you for your purchase! 🎉
            <br />
            Your Juice WRLD merch is on its way.
          </motion.p>

          {/* Order Details */}
          <motion.div
            className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-8 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">What's Next?</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Mail className="w-8 h-8 text-accent mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Confirmation Email</h3>
                <p className="text-gray-400 text-sm">
                  Check your email for order confirmation and tracking info
                </p>
              </div>

              <div className="text-center">
                <Download className="w-8 h-8 text-accent mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Processing</h3>
                <p className="text-gray-400 text-sm">
                  We'll prepare your order within 1-2 business days
                </p>
              </div>

              <div className="text-center">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-black text-sm font-bold">999</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Delivery</h3>
                <p className="text-gray-400 text-sm">
                  Your merch will arrive in 5-7 business days
                </p>
              </div>
            </div>
          </motion.div>

          {/* 999 Club Message */}
          <motion.div
            className="bg-gradient-to-r from-purple-900/20 to-green-400/20 rounded-xl border border-accent/30 p-6 mb-8"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0 }}
          >
            <h3 className="text-accent font-bold text-xl mb-2 flex items-center justify-center gap-2">
              <span className="bg-accent text-black px-3 py-1 rounded-full text-sm font-bold">999</span>
              Welcome to the Club!
            </h3>
            <p className="text-gray-300">
              You're now part of the 999 Club family. Watch your email for exclusive drops,
              early access, and special member benefits. Legends Never Die! 🦋
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
          >
            <motion.button
              onClick={() => router.push('/')}
              className="btn-primary flex items-center gap-2 neon-glow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Home className="w-4 h-4" />
              Continue Shopping
            </motion.button>

            <motion.button
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Download className="w-4 h-4" />
              Save Receipt
            </motion.button>
          </motion.div>

          {/* Animated 999 */}
          <motion.div
            className="mt-12 text-accent/60 text-6xl font-bold"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [0.95, 1.05, 0.95]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            999 ∞
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}