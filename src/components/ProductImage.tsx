'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

interface ProductImageProps {
  src?: string
  alt: string
  className?: string
  productName?: string
}

export default function ProductImage({ src, alt, className = "", productName }: ProductImageProps) {
  const [imageError, setImageError] = useState(false)

  // Generate a consistent gradient based on product name
  const getGradientColor = (name?: string) => {
    if (!name) return "from-purple-600 to-green-400"

    const colors = [
      "from-purple-600 to-blue-500",
      "from-green-400 to-yellow-400",
      "from-pink-500 to-red-500",
      "from-blue-500 to-purple-600",
      "from-yellow-400 to-orange-500",
      "from-red-500 to-pink-500",
      "from-indigo-500 to-blue-500",
      "from-teal-400 to-green-400"
    ]

    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  // If no src or image failed to load, show gradient placeholder
  if (!src || imageError) {
    return (
      <div className={`relative overflow-hidden bg-gradient-to-br ${getGradientColor(productName)} ${className}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
          <motion.div
            className="text-6xl font-bold mb-2"
            animate={{
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            999
          </motion.div>
          <div className="text-sm font-medium text-center px-4">
            {productName?.split(' ').slice(0, 2).join(' ') || 'Juice WRLD'}
          </div>
        </div>

        {/* Animated particles */}
        <div className="absolute inset-0">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/10 rounded-full"
              style={{
                top: `${20 + (i * 15)}%`,
                left: `${10 + (i * 12)}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.1, 0.3, 0.1],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setImageError(true)}
      loading="lazy"
    />
  )
}