'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, User, MapPin, Star, Send } from 'lucide-react'
import Modal from './Modal'

interface TestimonialSubmissionModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function TestimonialSubmissionModal({ isOpen, onClose }: TestimonialSubmissionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    testimonial: '',
    productPurchased: '',
    rating: 5,
    isAnonymous: false,
    allowPublic: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/testimonials', {
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
            testimonial: '',
            productPurchased: '',
            rating: 5,
            isAnonymous: false,
            allowPublic: true
          })
        }, 3000)
      } else {
        console.error('Testimonial submission failed:', result.error)
        // Handle error - for now just log it
      }
    } catch (error) {
      console.error('Testimonial submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="💜 Story Shared!" maxWidth="max-w-lg">
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
            Thank you for sharing your story!
          </h3>
          <p className="text-gray-300 mb-6">
            Your testimonial helps other fans connect and shows the amazing impact
            of the 999 family. Your story might be featured on our community page.
          </p>

          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-sm">
              999 family strong 💜 Your voice matters
            </p>
          </div>
        </motion.div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Your 999 Story" maxWidth="max-w-2xl">
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
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="name"
                  required={!formData.isAnonymous}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
                  placeholder="Your name"
                />
              </div>
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
                  placeholder="City, State/Country"
                />
              </div>
            </div>
          </div>
        )}

        {/* Product Purchased */}
        <div>
          <label htmlFor="productPurchased" className="block text-sm font-semibold text-white mb-2">
            Product Purchased (Optional)
          </label>
          <input
            type="text"
            id="productPurchased"
            value={formData.productPurchased}
            onChange={(e) => setFormData({ ...formData, productPurchased: e.target.value })}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
            placeholder="999 Forever Hoodie, Legends Never Die Tee, etc."
          />
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-semibold text-white mb-3">
            Overall Experience
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <motion.button
                key={star}
                type="button"
                className={`text-2xl transition-colors ${
                  star <= formData.rating ? 'text-yellow-400' : 'text-gray-600'
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setFormData({ ...formData, rating: star })}
              >
                <Star className={`w-8 h-8 ${star <= formData.rating ? 'fill-yellow-400' : ''}`} />
              </motion.button>
            ))}
            <span className="ml-3 text-gray-400">
              {formData.rating === 5 ? 'Amazing!' :
               formData.rating === 4 ? 'Great!' :
               formData.rating === 3 ? 'Good' :
               formData.rating === 2 ? 'Okay' : 'Poor'}
            </span>
          </div>
        </div>

        {/* Testimonial */}
        <div>
          <label htmlFor="testimonial" className="block text-sm font-semibold text-white mb-2">
            Your Story *
          </label>
          <textarea
            id="testimonial"
            required
            rows={6}
            value={formData.testimonial}
            onChange={(e) => setFormData({ ...formData, testimonial: e.target.value })}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors resize-none"
            placeholder="Share your experience with Juice WRLD's music, our merchandise, or how the 999 family has impacted your life..."
          />
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <span>Share your authentic experience</span>
            <span>{formData.testimonial.length}/500</span>
          </div>
        </div>

        {/* Public Display Permission */}
        <div className="flex items-center gap-3">
          <motion.label
            className="relative inline-flex items-center cursor-pointer"
            whileTap={{ scale: 0.95 }}
          >
            <input
              type="checkbox"
              checked={formData.allowPublic}
              onChange={(e) => setFormData({ ...formData, allowPublic: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-12 h-6 rounded-full transition-colors ${
              formData.allowPublic ? 'bg-accent' : 'bg-gray-600'
            }`}>
              <motion.div
                className="w-5 h-5 bg-white rounded-full shadow-md"
                animate={{
                  x: formData.allowPublic ? 26 : 2,
                  y: 2
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
            <span className="ml-3 text-sm text-white">
              Allow this story to be featured publicly
            </span>
          </motion.label>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={!formData.testimonial || (!formData.isAnonymous && !formData.name) || isSubmitting}
          className={`w-full py-4 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
            !formData.testimonial || (!formData.isAnonymous && !formData.name) || isSubmitting
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white neon-glow'
          }`}
          whileHover={
            formData.testimonial && (formData.isAnonymous || formData.name) && !isSubmitting
              ? { scale: 1.02 }
              : {}
          }
          whileTap={
            formData.testimonial && (formData.isAnonymous || formData.name) && !isSubmitting
              ? { scale: 0.98 }
              : {}
          }
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sharing Story...
            </>
          ) : (
            <>
              <Heart className="w-5 h-5" />
              Share My Story
            </>
          )}
        </motion.button>

        {/* Note */}
        <p className="text-xs text-gray-400 text-center">
          Your story will be reviewed before being featured. We respect your privacy
          and only share stories with explicit permission.
        </p>
      </form>
    </Modal>
  )
}