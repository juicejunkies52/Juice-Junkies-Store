'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Star, Calendar, Users } from 'lucide-react'
import MemorySubmissionModal from './MemorySubmissionModal'

export default function MemorialSection() {
  const [showMemoryModal, setShowMemoryModal] = useState(false)
  const memories = [
    {
      date: "Dec 8, 2019",
      title: "Forever in our hearts",
      message: "A young legend who touched millions with his music and authenticity",
      author: "The 999 Family",
      hearts: 999999
    },
    {
      date: "Born Dec 2, 1998",
      title: "Jarad Anthony Higgins",
      message: "From Chicago with love, spreading positivity through pain",
      author: "Hometown Hero",
      hearts: 120298
    },
    {
      date: "Legacy Lives On",
      title: "Legends Never Die",
      message: "His music continues to heal and inspire new generations",
      author: "999 Forever",
      hearts: 777777
    }
  ]

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
          {memories.map((memory, index) => (
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
          ))}
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
              <div className="text-4xl font-bold text-accent mb-2">999,999+</div>
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
                top: `${20 + Math.random() * 60}%`,
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