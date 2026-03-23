'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share2, Facebook, Play } from 'lucide-react'
import FanArtSubmissionModal from './FanArtSubmissionModal'
import TestimonialSubmissionModal from './TestimonialSubmissionModal'

export default function CommunitySection() {
  const [showFanArtModal, setShowFanArtModal] = useState(false)
  const [showTestimonialModal, setShowTestimonialModal] = useState(false)
  const [testimonials, setTestimonials] = useState([])
  const [fanArt, setFanArt] = useState([])
  const [loading, setLoading] = useState(true)

  // Load real testimonials and fan art from database
  useEffect(() => {
    const loadCommunityData = async () => {
      try {
        const [testimonialsRes, fanArtRes] = await Promise.all([
          fetch('/api/testimonials?approved=true'),
          fetch('/api/fan-art?approved=true')
        ])

        if (testimonialsRes.ok) {
          const testimonialsData = await testimonialsRes.json()
          setTestimonials(testimonialsData.testimonials || [])
        }

        if (fanArtRes.ok) {
          const fanArtData = await fanArtRes.json()
          setFanArt(fanArtData.fanArt || [])
        }
      } catch (error) {
        console.error('Error loading community data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCommunityData()
  }, [])

  const shareTestimonial = (testimonial: any) => {
    const text = `"${testimonial.testimonial.substring(0, 100)}..." - ${testimonial.name || 'Anonymous'} from the 999 family 💜`
    const url = window.location.href

    if (navigator.share) {
      navigator.share({
        title: '999 Community Story',
        text: text,
        url: url
      })
    } else {
      const shareText = encodeURIComponent(`${text}\n\nJoin the 999 community: ${url}`)
      window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank')
    }
  }

  const shareArt = (art: any) => {
    const text = `Check out this amazing fan art: "${art.title}" by @${art.artistName} 🎨 #999Art #JuiceWRLD`
    const url = window.location.href

    if (navigator.share) {
      navigator.share({
        title: '999 Fan Art',
        text: text,
        url: url
      })
    } else {
      const shareText = encodeURIComponent(`${text}\n\n${url}`)
      window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank')
    }
  }

  const socialStats = [
    { platform: "Facebook", icon: Facebook, followers: "242,803", color: "text-blue-400" }
  ]

  return (
    <section className="relative z-40 py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-4 font-mono">
            999 COMMUNITY
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Join millions of fans worldwide celebrating Juice WRLD's legacy together
          </p>
        </motion.div>

        {/* Social Media Stats */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {socialStats.map((social, index) => (
            <motion.div
              key={social.platform}
              className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-6 text-center hover:border-accent/50 transition-all duration-300"
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ delay: index * 0.1 }}
            >
              <social.icon className={`w-8 h-8 ${social.color} mx-auto mb-3`} />
              <h3 className="text-white font-bold text-lg">{social.followers}</h3>
              <p className="text-gray-400">Followers on {social.platform}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Fan Testimonials */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-500" />
              Fan Stories
            </h3>

            <div className="space-y-6">
              {loading ? (
                // Loading skeleton
                [...Array(3)].map((_, index) => (
                  <div key={index} className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 animate-pulse">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-gray-700 rounded w-1/4"></div>
                        <div className="h-3 bg-gray-700 rounded w-full"></div>
                        <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : testimonials.length > 0 ? (
                testimonials.map((testimonial: any, index: number) => (
                  <motion.div
                    key={testimonial.id}
                    className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.2 }}
                    whileHover={{ borderColor: 'rgba(106, 13, 173, 0.5)' }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-green-400 rounded-full flex items-center justify-center font-bold text-white">
                        {testimonial.name ? testimonial.name.charAt(0).toUpperCase() : 'A'}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-white font-semibold">{testimonial.name || 'Anonymous'}</h4>
                          {testimonial.location && <span className="text-gray-400 text-sm">{testimonial.location}</span>}
                        </div>

                        <div className="flex items-center gap-1 mb-3">
                          {[...Array(testimonial.rating || 5)].map((_, i) => (
                            <motion.div
                              key={i}
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ delay: i * 0.1, duration: 0.5 }}
                            >
                              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                            </motion.div>
                          ))}
                        </div>

                        <p className="text-gray-300 mb-3 leading-relaxed">
                          "{testimonial.testimonial}"
                        </p>

                        <div className="flex items-center justify-between">
                          {testimonial.productPurchased && (
                            <span className="text-accent text-sm font-semibold">
                              Purchased: {testimonial.productPurchased}
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            <motion.button
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Heart className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              className="text-gray-400 hover:text-blue-400 transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => shareTestimonial(testimonial)}
                            >
                              <Share2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                // Empty state for testimonials
                <motion.div
                  className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-12 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h4 className="text-white font-bold text-xl mb-2">Be the First to Share</h4>
                  <p className="text-gray-400 mb-6">No fan stories yet. Share your experience with Juice WRLD's music and be the first to inspire others.</p>
                  <motion.button
                    className="btn-primary px-6 py-3"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowTestimonialModal(true)}
                  >
                    Share Your Story
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Fan Art Showcase */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
              <Play className="w-8 h-8 text-accent" />
              Fan Creations
            </h3>

            <div className="space-y-6">
              {loading ? (
                // Loading skeleton
                [...Array(3)].map((_, index) => (
                  <div key={index} className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden animate-pulse">
                    <div className="aspect-video bg-gray-700"></div>
                    <div className="p-6 space-y-3">
                      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                ))
              ) : fanArt.length > 0 ? (
                fanArt.map((art: any, index: number) => (
                  <motion.div
                    key={art.id}
                    className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden hover:border-accent/50 transition-all duration-300"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.2 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    {/* Art Preview */}
                    <div className="aspect-video bg-gradient-to-br from-purple-600 via-blue-500 to-green-400 relative overflow-hidden">
                      {art.fileName ? (
                        <img
                          src={`/api/fan-art/image/${art.fileName}`}
                          alt={art.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.div
                            className="text-white/20 text-6xl font-bold"
                            animate={{
                              opacity: [0.2, 0.4, 0.2],
                              scale: [1, 1.1, 1]
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          >
                            999
                          </motion.div>
                        </div>
                      )}

                      {/* Play button overlay */}
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                        whileHover={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                      >
                        <motion.div
                          className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Play className="w-8 h-8 text-white ml-1" />
                        </motion.div>
                      </motion.div>
                    </div>

                    {/* Art Info */}
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-bold text-lg">{art.title}</h4>
                          <p className="text-gray-400">by @{art.artistName}</p>
                        </div>

                        <motion.div
                          className="flex items-center gap-2"
                          whileHover={{ scale: 1.05 }}
                        >
                          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                          <span className="text-white font-semibold">
                            {art.likes?.toLocaleString() || 0}
                          </span>
                        </motion.div>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-semibold">
                          {art.type}
                        </span>

                        <div className="flex items-center gap-2">
                          <motion.button
                            className="text-gray-400 hover:text-accent transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <MessageCircle className="w-5 h-5" />
                          </motion.button>
                          <motion.button
                            className="text-gray-400 hover:text-blue-400 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => shareArt(art)}
                          >
                            <Share2 className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                // Empty state for fan art
                <motion.div
                  className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-12 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <Play className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h4 className="text-white font-bold text-xl mb-2">Showcase Your Art</h4>
                  <p className="text-gray-400 mb-6">No fan art submissions yet. Share your creative tributes and be the first to showcase your artwork.</p>
                  <motion.button
                    className="btn-secondary px-6 py-3"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowFanArtModal(true)}
                  >
                    Submit Fan Art
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Community CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="text-3xl font-bold text-white mb-6">Join the 999 Family</h3>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Share your story, showcase your art, and connect with fans worldwide
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              className="btn-primary px-8 py-4 flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowTestimonialModal(true)}
            >
              <Heart className="w-5 h-5" />
              Share Your Story
            </motion.button>

            <motion.button
              className="btn-secondary px-8 py-4 flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFanArtModal(true)}
            >
              <Share2 className="w-5 h-5" />
              Submit Fan Art
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Fan Art Submission Modal */}
      <FanArtSubmissionModal
        isOpen={showFanArtModal}
        onClose={() => setShowFanArtModal(false)}
      />

      {/* Testimonial Submission Modal */}
      <TestimonialSubmissionModal
        isOpen={showTestimonialModal}
        onClose={() => setShowTestimonialModal(false)}
      />
    </section>
  )
}