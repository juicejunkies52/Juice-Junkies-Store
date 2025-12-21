'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, Star, Zap, Heart } from 'lucide-react'
import AnimatedBackground from '@/components/AnimatedBackground'
import FloatingButterfly from '@/components/FloatingButterfly'
import SoundWaveVisualization, { FloatingMusicNotes } from '@/components/SoundWaveVisualization'
import Logo from '@/components/Logo'
import FeaturedProducts from '@/components/FeaturedProducts'
import CartIcon from '@/components/CartIcon'
import AudioPlayer from '@/components/AudioPlayer'
import MemorialSection from '@/components/MemorialSection'
import EnhancedButterflies from '@/components/EnhancedButterflies'
import LyricOverlay from '@/components/LyricOverlay'
import LimitedDropBanner from '@/components/LimitedDropBanner'
import CommunitySection from '@/components/CommunitySection'

export default function Home() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          source: 'club999'
        })
      })

      const result = await response.json()

      if (response.ok) {
        setIsSubmitted(true)
        setEmail('')
        setTimeout(() => setIsSubmitted(false), 3000)
      } else {
        console.error('Newsletter signup failed:', result.error)
        // Handle error - for now just log it
      }
    } catch (error) {
      console.error('Newsletter signup error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Limited Drop Banner */}
      <LimitedDropBanner />

      {/* Animated Background */}
      <AnimatedBackground />

      {/* Enhanced Butterflies */}
      <EnhancedButterflies />

      {/* Floating Music Notes */}
      <FloatingMusicNotes />

      {/* Sound Wave Visualization */}
      <SoundWaveVisualization />

      {/* Lyric Overlay */}
      <LyricOverlay />

      {/* Audio Player */}
      <AudioPlayer />

      {/* Navigation Header */}
      <nav className="relative z-50 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Logo size="medium" variant="header" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-6"
        >
          <a href="/shop" className="text-white hover:text-accent transition-colors">Shop</a>
          <a href="#collections" className="text-white hover:text-accent transition-colors">Collections</a>
          <a href="#about" className="text-white hover:text-accent transition-colors">About</a>
          <CartIcon />
        </motion.div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-40 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <motion.h1
            className="text-6xl md:text-8xl font-bold mb-6 text-gradient font-mono"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            LEGENDS
            <br />
            <span className="neon-text animate-pulse-neon">NEVER DIE</span>
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Premium Juice WRLD merchandise for true fans.
            <br />
            Honor the legacy. Keep the memory alive.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <button className="btn-primary neon-glow flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Shop Juice Collection
            </button>
            <button className="btn-secondary flex items-center gap-2">
              <Heart className="w-5 h-5" />
              Memorial Collection
            </button>
          </motion.div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-accent">240K+</div>
            <div className="text-gray-400">Community Members</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-accent">999</div>
            <div className="text-gray-400">Juice Junkies Unite</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-accent">100%</div>
            <div className="text-gray-400">Premium Quality</div>
          </div>
        </motion.div>
      </section>

      {/* Featured Products */}
      <FeaturedProducts />

      {/* Memorial Section */}
      <MemorialSection />

      {/* Community Section */}
      <CommunitySection />

      {/* Newsletter Banner */}
      <section className="relative z-40 py-12 bg-gradient-to-r from-purple-900/50 to-green-400/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            {isSubmitted ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">Welcome to Club 999! 💜</h3>
                <p className="text-gray-300">
                  You're now part of the family. Check your email for exclusive content!
                </p>
              </motion.div>
            ) : (
              <>
                <h3 className="text-3xl md:text-4xl font-bold mb-4 text-white font-mono">
                  JOIN THE 999 CLUB
                </h3>
                <p className="text-xl text-gray-300 mb-6">
                  Get exclusive drops, limited releases, and special member pricing
                </p>
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="px-4 py-3 bg-black/50 border border-accent rounded-lg text-white placeholder-gray-400 flex-1 focus:border-accent/80 focus:outline-none transition-colors"
                  />
                  <motion.button
                    type="submit"
                    disabled={!email || isSubmitting}
                    className={`btn-primary whitespace-nowrap flex items-center gap-2 ${
                      !email || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    whileHover={email && !isSubmitting ? { scale: 1.05 } : {}}
                    whileTap={email && !isSubmitting ? { scale: 0.95 } : {}}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <Heart className="w-4 h-4" />
                        Join Club 999
                      </>
                    )}
                  </motion.button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </section>
    </main>
  )
}
