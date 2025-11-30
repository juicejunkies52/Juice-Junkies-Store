'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Mail, User, Phone, Zap } from 'lucide-react'
import Modal from './Modal'

interface EarlyAccessModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function EarlyAccessModal({ isOpen, onClose }: EarlyAccessModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    size: 'M',
    notifications: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/early-access', {
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
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            size: 'M',
            notifications: true
          })
        }, 3000)
      } else {
        console.error('Early access signup failed:', result.error)
        // Handle error - for now just log it
      }
    } catch (error) {
      console.error('Early access signup error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="⚡ Early Access Secured!" maxWidth="max-w-lg">
        <motion.div
          className="text-center py-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="w-20 h-20 bg-gradient-to-r from-yellow-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6"
            animate={{
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 2,
              ease: "easeInOut"
            }}
          >
            <Star className="w-10 h-10 text-white" />
          </motion.div>

          <h3 className="text-2xl font-bold text-white mb-4">
            You're on the VIP list!
          </h3>
          <p className="text-gray-300 mb-6">
            Congratulations! You'll get exclusive 24-hour early access to the 999 Anniversary Drop.
            Check your email for confirmation and drop details.
          </p>

          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              ⚡ Early access starts 24 hours before public launch
            </p>
          </div>
        </motion.div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🌟 Get Early Access" maxWidth="max-w-2xl">
      <div className="mb-6 text-center">
        <div className="bg-gradient-to-r from-yellow-500/10 to-purple-600/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
          <p className="text-yellow-300 text-sm">
            ⚡ Limited to first 100 sign-ups • 24-hour exclusive access
          </p>
        </div>
        <p className="text-gray-300 text-sm">
          Be among the first to access our exclusive 999 Anniversary Memorial Collection
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-semibold text-white mb-2">
              First Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="firstName"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
                placeholder="First name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-semibold text-white mb-2">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
              placeholder="Last name"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
              placeholder="your@email.com"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-white mb-2">
            Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
              placeholder="(555) 123-4567"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Optional - for drop reminders via SMS
          </p>
        </div>

        {/* Size Preference */}
        <div>
          <label className="block text-sm font-semibold text-white mb-3">
            Preferred Size *
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {sizes.map((size) => (
              <motion.label
                key={size}
                className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.size === size
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-gray-700 bg-gray-900/30 hover:border-gray-600 text-white'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="font-semibold">{size}</span>
                <input
                  type="radio"
                  name="size"
                  value={size}
                  checked={formData.size === size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="sr-only"
                />
              </motion.label>
            ))}
          </div>
        </div>

        {/* Notifications Toggle */}
        <div className="flex items-center gap-3">
          <motion.label
            className="relative inline-flex items-center cursor-pointer"
            whileTap={{ scale: 0.95 }}
          >
            <input
              type="checkbox"
              checked={formData.notifications}
              onChange={(e) => setFormData({ ...formData, notifications: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-12 h-6 rounded-full transition-colors ${
              formData.notifications ? 'bg-accent' : 'bg-gray-600'
            }`}>
              <motion.div
                className="w-5 h-5 bg-white rounded-full shadow-md"
                animate={{
                  x: formData.notifications ? 26 : 2,
                  y: 2
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
            <span className="ml-3 text-sm text-white">
              Send me drop reminders and exclusive updates
            </span>
          </motion.label>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={!formData.firstName || !formData.lastName || !formData.email || isSubmitting}
          className={`w-full py-4 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
            !formData.firstName || !formData.lastName || !formData.email || isSubmitting
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-yellow-500 to-purple-600 hover:from-yellow-400 hover:to-purple-500 text-white neon-glow'
          }`}
          whileHover={
            formData.firstName && formData.lastName && formData.email && !isSubmitting
              ? { scale: 1.02 }
              : {}
          }
          whileTap={
            formData.firstName && formData.lastName && formData.email && !isSubmitting
              ? { scale: 0.98 }
              : {}
          }
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Securing Access...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Get VIP Early Access
            </>
          )}
        </motion.button>

        {/* Terms */}
        <p className="text-xs text-gray-400 text-center">
          By signing up, you agree to receive early access notifications and exclusive updates.
          Limited spots available - first come, first served.
        </p>
      </form>
    </Modal>
  )
}