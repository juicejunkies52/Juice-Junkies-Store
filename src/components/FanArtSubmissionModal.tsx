'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, Image, Palette, Star, Send } from 'lucide-react'
import Modal from './Modal'

interface FanArtSubmissionModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function FanArtSubmissionModal({ isOpen, onClose }: FanArtSubmissionModalProps) {
  const [formData, setFormData] = useState({
    artistName: '',
    title: '',
    type: 'digital',
    description: '',
    socialHandle: '',
    file: null as File | null
  })
  const [dragActive, setDragActive] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const artTypes = [
    { value: 'digital', label: 'Digital Art', icon: Palette },
    { value: 'painting', label: 'Painting', icon: Image },
    { value: 'design', label: 'Graphic Design', icon: Star },
    { value: 'photo', label: 'Photography', icon: Image }
  ]

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        setFormData({ ...formData, file })
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formDataToSubmit = new FormData()
      formDataToSubmit.append('artistName', formData.artistName)
      formDataToSubmit.append('title', formData.title)
      formDataToSubmit.append('type', formData.type)
      formDataToSubmit.append('description', formData.description || '')
      formDataToSubmit.append('socialHandle', formData.socialHandle || '')
      if (formData.file) {
        formDataToSubmit.append('file', formData.file)
      }

      const response = await fetch('/api/fan-art', {
        method: 'POST',
        body: formDataToSubmit
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitted(true)
        // Auto close after success
        setTimeout(() => {
          onClose()
          setSubmitted(false)
          setFormData({
            artistName: '',
            title: '',
            type: 'digital',
            description: '',
            socialHandle: '',
            file: null
          })
        }, 3000)
      } else {
        console.error('Fan art submission failed:', result.error)
        // Handle error - for now just log it
      }
    } catch (error) {
      console.error('Fan art submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="🎉 Submission Received!" maxWidth="max-w-lg">
        <motion.div
          className="text-center py-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="w-20 h-20 bg-gradient-to-r from-purple-600 to-green-400 rounded-full flex items-center justify-center mx-auto mb-6"
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
            Your art has been submitted!
          </h3>
          <p className="text-gray-300 mb-6">
            Thank you for sharing your creativity with the 999 family.
            Your submission will be reviewed and featured in our community gallery.
          </p>

          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
            <p className="text-accent text-sm">
              💜 Keep creating and spreading the 999 love!
            </p>
          </div>
        </motion.div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit Your Fan Art" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Artist Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="artistName" className="block text-sm font-semibold text-white mb-2">
              Artist Name *
            </label>
            <input
              type="text"
              id="artistName"
              required
              value={formData.artistName}
              onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
              placeholder="Your artist name"
            />
          </div>

          <div>
            <label htmlFor="socialHandle" className="block text-sm font-semibold text-white mb-2">
              Social Handle
            </label>
            <input
              type="text"
              id="socialHandle"
              value={formData.socialHandle}
              onChange={(e) => setFormData({ ...formData, socialHandle: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
              placeholder="@yourhandle"
            />
          </div>
        </div>

        {/* Artwork Info */}
        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-white mb-2">
            Artwork Title *
          </label>
          <input
            type="text"
            id="title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
            placeholder="What's your creation called?"
          />
        </div>

        {/* Art Type */}
        <div>
          <label className="block text-sm font-semibold text-white mb-3">
            Art Type *
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {artTypes.map((type) => (
              <motion.label
                key={type.value}
                className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.type === type.value
                    ? 'border-accent bg-accent/10'
                    : 'border-gray-700 bg-gray-900/30 hover:border-gray-600'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <type.icon className={`w-6 h-6 mb-2 ${
                  formData.type === type.value ? 'text-accent' : 'text-gray-400'
                }`} />
                <span className={`text-sm font-medium ${
                  formData.type === type.value ? 'text-accent' : 'text-white'
                }`}>
                  {type.label}
                </span>
                <input
                  type="radio"
                  name="type"
                  value={type.value}
                  checked={formData.type === type.value}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="sr-only"
                />
              </motion.label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-white mb-2">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors resize-none"
            placeholder="Tell us about your artwork and what inspired you..."
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-semibold text-white mb-3">
            Upload Your Artwork *
          </label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              dragActive
                ? 'border-accent bg-accent/5'
                : formData.file
                ? 'border-green-500 bg-green-500/5'
                : 'border-gray-600 bg-gray-900/30'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {formData.file ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <Image className="w-8 h-8 text-white" />
                </div>
                <p className="text-white font-semibold">{formData.file.name}</p>
                <p className="text-gray-400 text-sm">
                  {(formData.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </motion.div>
            ) : (
              <motion.div
                className="space-y-3"
                animate={dragActive ? { scale: 1.05 } : { scale: 1 }}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-white font-semibold">Drop your artwork here</p>
                  <p className="text-gray-400 text-sm">or click to browse files</p>
                </div>
                <p className="text-gray-500 text-xs">PNG, JPG, GIF up to 10MB</p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={!formData.artistName || !formData.title || !formData.file || isSubmitting}
          className={`w-full py-4 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
            !formData.artistName || !formData.title || !formData.file || isSubmitting
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white neon-glow'
          }`}
          whileHover={
            formData.artistName && formData.title && formData.file && !isSubmitting
              ? { scale: 1.02 }
              : {}
          }
          whileTap={
            formData.artistName && formData.title && formData.file && !isSubmitting
              ? { scale: 0.98 }
              : {}
          }
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit to 999 Gallery
            </>
          )}
        </motion.button>

        {/* Terms */}
        <p className="text-xs text-gray-400 text-center">
          By submitting, you agree to let us feature your art in our community gallery
          and give you full credit. You retain all rights to your artwork.
        </p>
      </form>
    </Modal>
  )
}