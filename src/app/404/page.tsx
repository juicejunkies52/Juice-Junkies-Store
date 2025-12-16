'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Home } from 'lucide-react'
import AnimatedBackground from '@/components/AnimatedBackground'
import FloatingButterfly from '@/components/FloatingButterfly'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <AnimatedBackground />
      <FloatingButterfly />

      <div className="relative z-40 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.h1
            className="text-8xl md:text-9xl font-bold text-accent mb-4 font-mono"
            animate={{
              textShadow: [
                '0 0 20px rgba(106, 13, 173, 0.5)',
                '0 0 40px rgba(106, 13, 173, 0.8)',
                '0 0 20px rgba(106, 13, 173, 0.5)'
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            404
          </motion.h1>

          <motion.p
            className="text-2xl md:text-3xl text-white mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Page Not Found
          </motion.p>

          <motion.p
            className="text-lg text-gray-300 mb-8 max-w-md mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            The page you&apos;re looking for doesn&apos;t exist.
            <br />
            Let&apos;s get you back to the good stuff.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <motion.button
              onClick={() => router.back()}
              className="btn-secondary flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </motion.button>

            <motion.button
              onClick={() => router.push('/')}
              className="btn-primary flex items-center gap-2 neon-glow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Home className="w-4 h-4" />
              Home
            </motion.button>
          </motion.div>

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
            999
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}