'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, Star, Calendar, Users } from 'lucide-react'
import MemorySubmissionModal from './MemorySubmissionModal'

export default function MemorialSection() {
  const [showMemoryModal, setShowMemoryModal] = useState(false)
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [memoryStats, setMemoryStats] = useState({ total: 999999 })

  // Load real memories from database
  useEffect(() => {
    const loadMemories = async () => {
      try {
        const response = await fetch('/api/memories')
        if (response.ok) {
          const data = await response.json()
          setMemories(data.memories || [])
          setMemoryStats(data.stats || { total: 999999 })
        }
      } catch (error) {
        console.error('Error loading memories:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMemories()
  }, [])

  // Stable heart positions to avoid hydration mismatch
  const heartPositions = [30, 55, 75, 40, 25, 65]

  // Display real memories if available
  const displayMemories = memories.length > 0 ? memories.slice(0, 3).map(memory => ({
    date: new Date(memory.createdAt).toLocaleDateString(),
    title: memory.favoriteSong || 'A Special Memory',
    message: memory.memory,
    author: memory.name || 'Anonymous Fan',
    hearts: Math.floor(Math.random() * 50000) + 1000 // Random hearts for user memories
  })) : []

  return (
    <section className="relative z-40 py-20 px-6 bg-gradient-to-b from-transparent via-black/20 to-transparent">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="text-6xl md:text-8xl font-bold text-accent mb-6 font-mono"
            animate={{
              textShadow: [
                '0 0 20px rgba(106, 13, 173, 0.5)',
                '0 0 40px rgba(106, 13, 173, 0.8)',
                '0 0 20px rgba(106, 13, 173, 0.5)'
              ]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            999
          </motion.div>

          <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">
            In Loving Memory
          </h2>

          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Celebrating the life and legacy of a true artist who showed us that
            even in our darkest moments, we can find light.
          </p>
        </motion.div>

        {/* Memory Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {loading ? (
            // Loading skeleton
            [...Array(3)].map((_, index) => (
              <div key={index} className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-8 animate-pulse">
                <div className="space-y-4">
                  <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                  <div className="h-6 bg-gray-700 rounded w-2/3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-700 rounded w-full"></div>
                    <div className="h-3 bg-gray-700 rounded w-4/5"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-gray-700 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/5"></div>
                  </div>
                </div>
              </div>
            ))
          ) : displayMemories.length > 0 ? (
            displayMemories.map((memory, index) => (
            <motion.div
              key={index}
              className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-8 hover:border-accent/50 transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              whileHover={{
                y: -5,
                boxShadow: "0 20px 40px rgba(106, 13, 173, 0.2)"
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-accent" />
                <span className="text-accent font-semibold">{memory.date}</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-4">
                {memory.title}
              </h3>

              <p className="text-gray-300 mb-6 leading-relaxed">
                {memory.message}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400 text-sm">{memory.author}</span>
                </div>

                <motion.div
                  className="flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                >
                  <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  <span className="text-white font-semibold">
                    {memory.hearts.toLocaleString()}
                  </span>
                </motion.div>
              </div>
            </motion.div>
            ))
          ) : (
            // Empty state when no memories exist
            <div className="col-span-full">
              <motion.div
                className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-12 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h4 className="text-white font-bold text-xl mb-2">Memorial Wall</h4>
                <p className="text-gray-400 mb-6">No memories have been shared yet. Be the first to add to our memorial wall and honor Juice WRLD's legacy.</p>
                <motion.button
                  className="btn-primary px-6 py-3"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowMemoryModal(true)}
                >
                  Share a Memory
                </motion.button>
              </motion.div>
            </div>
          )}
        </div>

        {/* Interactive Tribute Wall */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-3xl font-bold text-white mb-6">Share Your Memory</h3>
          <p className="text-gray-300 mb-8">
            Leave a message for Jarad and the 999 family
          </p>

          <motion.button
            className="btn-primary px-8 py-4 text-lg neon-glow flex items-center gap-3 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMemoryModal(true)}
          >
            <Heart className="w-5 h-5" />
            Add to Memorial Wall
          </motion.button>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
            >
              <div className="text-4xl font-bold text-accent mb-2">{memoryStats.total.toLocaleString()}+</div>
              <div className="text-gray-400">Memories Shared</div>
            </motion.div>

            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.0 }}
            >
              <div className="text-4xl font-bold text-accent mb-2">∞</div>
              <div className="text-gray-400">Lives Touched</div>
            </motion.div>

            <motion.div
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.2 }}
            >
              <div className="text-4xl font-bold text-accent mb-2">999</div>
              <div className="text-gray-400">Forever</div>
            </motion.div>
          </div>
        </motion.div>

        {/* Floating Hearts Animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${10 + (i * 15)}%`,
                top: `${heartPositions[i]}%`,
              }}
              animate={{
                y: [-20, -80, -20],
                opacity: [0, 0.6, 0],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 4 + i,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 2
              }}
            >
              <Heart className="w-6 h-6 text-red-500/30 fill-red-500/30" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Memory Submission Modal */}
      <MemorySubmissionModal
        isOpen={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
      />
    </section>
  )
}