'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Send, MapPin, Calendar, Music } from 'lucide-react'
import Modal from './Modal'

interface MemorySubmissionModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function MemorySubmissionModal({ isOpen, onClose }: MemorySubmissionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    memory: '',
    favoriteSong: '',
    memoryType: 'general',
    isAnonymous: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const memoryTypes = [
    { value: 'general', label: 'General Memory', icon: Heart },
    { value: 'concert', label: 'Concert Experience', icon: Music },
    { value: 'personal', label: 'Personal Impact', icon: Heart },
    { value: 'tribute', label: 'Tribute', icon: Calendar }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitted(true)
        // Auto close after success
        setTimeout(() => {
          onClose()
          setSubmitted(false)
          setFormData({
            name: '',
            location: '',
            memory: '',
            favoriteSong: '',
            memoryType: 'general',
            isAnonymous: false
          })
        }, 3000)
      } else {
        console.error('Memory submission failed:', result.error)
        // Handle error - for now just log it
      }
    } catch (error) {
      console.error('Memory submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="💜 Memory Added" maxWidth="max-w-lg">
        <motion.div
          className="text-center py-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="w-20 h-20 bg-gradient-to-r from-purple-600 to-green-400 rounded-full flex items-center justify-center mx-auto mb-6"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.8, 1, 0.8]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Heart className="w-10 h-10 text-white fill-white" />
          </motion.div>

          <h3 className="text-2xl font-bold text-white mb-4">
            Your memory has been shared
          </h3>
          <p className="text-gray-300 mb-6">
            Thank you for adding to our memorial wall. Your memory helps keep
            Juice WRLD's spirit alive in the hearts of the 999 family.
          </p>

          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-sm">
              999 forever - Legends Never Die 💜
            </p>
          </div>
        </motion.div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Your Memory" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Anonymous Toggle */}
        <div className="flex items-center gap-3">
          <motion.label
            className="relative inline-flex items-center cursor-pointer"
            whileTap={{ scale: 0.95 }}
          >
            <input
              type="checkbox"
              checked={formData.isAnonymous}
              onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-12 h-6 rounded-full transition-colors ${
              formData.isAnonymous ? 'bg-accent' : 'bg-gray-600'
            }`}>
              <motion.div
                className="w-5 h-5 bg-white rounded-full shadow-md"
                animate={{
                  x: formData.isAnonymous ? 26 : 2,
                  y: 2
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
            <span className="ml-3 text-sm text-white">Share anonymously</span>
          </motion.label>
        </div>

        {/* Name and Location */}
        {!formData.isAnonymous && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-white mb-2">
                Your Name *
              </label>
              <input
                type="text"
                id="name"
                required={!formData.isAnonymous}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-semibold text-white mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
                  placeholder="City, Country"
                />
              </div>
            </div>
          </div>
        )}

        {/* Memory Type */}
        <div>
          <label className="block text-sm font-semibold text-white mb-3">
            Memory Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {memoryTypes.map((type) => (
              <motion.label
                key={type.value}
                className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.memoryType === type.value
                    ? 'border-accent bg-accent/10'
                    : 'border-gray-700 bg-gray-900/30 hover:border-gray-600'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <type.icon className={`w-6 h-6 mb-2 ${
                  formData.memoryType === type.value ? 'text-accent' : 'text-gray-400'
                }`} />
                <span className={`text-sm font-medium text-center ${
                  formData.memoryType === type.value ? 'text-accent' : 'text-white'
                }`}>
                  {type.label}
                </span>
                <input
                  type="radio"
                  name="memoryType"
                  value={type.value}
                  checked={formData.memoryType === type.value}
                  onChange={(e) => setFormData({ ...formData, memoryType: e.target.value })}
                  className="sr-only"
                />
              </motion.label>
            ))}
          </div>
        </div>

        {/* Favorite Song */}
        <div>
          <label htmlFor="favoriteSong" className="block text-sm font-semibold text-white mb-2">
            Favorite Juice WRLD Song
          </label>
          <div className="relative">
            <Music className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              id="favoriteSong"
              value={formData.favoriteSong}
              onChange={(e) => setFormData({ ...formData, favoriteSong: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
              placeholder="Lucid Dreams, Legends Never Die, All Girls Are The Same..."
            />
          </div>
        </div>

        {/* Memory Text */}
        <div>
          <label htmlFor="memory" className="block text-sm font-semibold text-white mb-2">
            Your Memory *
          </label>
          <textarea
            id="memory"
            required
            rows={6}
            value={formData.memory}
            onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors resize-none"
            placeholder="Share your memory of Juice WRLD, how his music impacted you, or a message to the 999 family..."
          />
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <span>Express yourself freely and authentically</span>
            <span>{formData.memory.length}/500</span>
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={!formData.memory || (!formData.isAnonymous && !formData.name) || isSubmitting}
          className={`w-full py-4 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
            !formData.memory || (!formData.isAnonymous && !formData.name) || isSubmitting
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white neon-glow'
          }`}
          whileHover={
            formData.memory && (formData.isAnonymous || formData.name) && !isSubmitting
              ? { scale: 1.02 }
              : {}
          }
          whileTap={
            formData.memory && (formData.isAnonymous || formData.name) && !isSubmitting
              ? { scale: 0.98 }
              : {}
          }
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Adding to Memorial...
            </>
          ) : (
            <>
              <Heart className="w-5 h-5" />
              Add to Memorial Wall
            </>
          )}
        </motion.button>

        {/* Note */}
        <p className="text-xs text-gray-400 text-center">
          Your memory will be reviewed before being added to the memorial wall.
          All submissions are moderated to maintain a respectful space for the 999 family.
        </p>
      </form>
    </Modal>
  )
}