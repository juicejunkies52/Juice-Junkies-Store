'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

interface LogoProps {
  className?: string
  size?: 'small' | 'medium' | 'large'
  variant?: 'header' | 'footer' | 'hero'
  blendMode?: 'screen' | 'multiply' | 'overlay' | 'normal'
}

export default function Logo({ className = '', size = 'medium', variant = 'header', blendMode = 'screen' }: LogoProps) {
  // Size configurations
  const sizeConfig = {
    small: { width: 120, height: 40 },
    medium: { width: 180, height: 60 },
    large: { width: 240, height: 80 }
  }

  const { width, height } = sizeConfig[size]

  // Check if custom logo exists, otherwise use text fallback
  const hasCustomLogo = true // Your custom logo is now uploaded!

  if (hasCustomLogo) {
    return (
      <motion.div
        className={`relative ${className}`}
        whileHover={{
          scale: 1.05,
          filter: "drop-shadow(0 0 10px #39ff14)"
        }}
        transition={{ duration: 0.2 }}
      >
        <Image
          src="/juice-junkies-logo.jpg" // Your actual logo file
          alt="Juice Junkies Logo"
          width={width}
          height={height}
          className={`object-contain ${
            blendMode === 'screen' ? 'logo-blend' :
            blendMode === 'multiply' ? 'logo-blend-multiply' :
            blendMode === 'overlay' ? 'logo-blend-overlay' :
            ''
          }`}
          priority
        />
      </motion.div>
    )
  }

  // Text-based logo fallback (current design)
  return (
    <motion.div
      className={`flex items-center space-x-2 ${className}`}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
    >
      {variant === 'hero' ? (
        // Large hero version
        <div className="text-center">
          <div className="text-4xl md:text-6xl font-bold text-gradient font-mono mb-2">
            JUICE JUNKIES
          </div>
          <div className="text-sm md:text-lg text-accent/80 tracking-widest">
            LEGENDS NEVER DIE
          </div>
        </div>
      ) : (
        // Header/footer version
        <>
          <span className={`font-bold text-gradient font-mono ${
            size === 'small' ? 'text-lg' :
            size === 'medium' ? 'text-2xl' : 'text-3xl'
          }`}>
            JUICE
          </span>
          <span className={`font-bold text-white ${
            size === 'small' ? 'text-md' :
            size === 'medium' ? 'text-xl' : 'text-2xl'
          }`}>
            JUNKIES
          </span>
        </>
      )}
    </motion.div>
  )
}

// Special animated logo for loading screens
export function AnimatedLogo() {
  return (
    <motion.div
      className="flex items-center space-x-2"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.span
        className="text-4xl font-bold text-gradient font-mono"
        animate={{
          textShadow: [
            "0 0 20px #39ff14",
            "0 0 40px #39ff14",
            "0 0 20px #39ff14"
          ]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        JUICE
      </motion.span>
      <motion.span
        className="text-4xl font-bold text-white"
        animate={{
          color: ["#ffffff", "#39ff14", "#ffffff"]
        }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      >
        JUNKIES
      </motion.span>
    </motion.div>
  )
}