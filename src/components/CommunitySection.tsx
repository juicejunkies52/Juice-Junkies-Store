'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, MessageCircle, Share2, Instagram, Twitter, Video, Play } from 'lucide-react'
import FanArtSubmissionModal from './FanArtSubmissionModal'
import TestimonialSubmissionModal from './TestimonialSubmissionModal'

export default function CommunitySection() {
  const [showFanArtModal, setShowFanArtModal] = useState(false)
  const [showTestimonialModal, setShowTestimonialModal] = useState(false)

  const shareTestimonial = (testimonial: any) => {
    const text = `"${testimonial.message.substring(0, 100)}..." - ${testimonial.name} from the 999 family 💜`
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
    const text = `Check out this amazing fan art: "${art.title}" by @${art.artist} 🎨 #999Art #JuiceWRLD`
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

  const testimonials = [
    {
      name: "Sarah M.",
      location: "Chicago, IL",
      message: "Juice saved my life. His music got me through the darkest times. Wearing his merch makes me feel connected to something bigger than myself.",
      avatar: "S",
      product: "999 Forever Hoodie",
      rating: 5
    },
    {
      name: "Marcus T.",
      location: "Atlanta, GA",
      message: "The quality is insane and the designs capture his spirit perfectly. Every piece tells a story and keeps his memory alive.",
      avatar: "M",
      product: "Legends Never Die Tee",
      rating: 5
    },
    {
      name: "Luna K.",
      location: "Los Angeles, CA",
      message: "I've been in the 999 family since day one. This store brings us all together. The community here is everything Juice represented - love and unity.",
      avatar: "L",
      product: "Butterfly Hoodie",
      rating: 5
    }
  ]

  const fanArt = [
    {
      artist: "ArtBy999",
      title: "Lucid Dreams Visual",
      likes: 12847,
      type: "digital"
    },
    {
      artist: "ButterflyCraze",
      title: "999 Portrait",
      likes: 8921,
      type: "painting"
    },
    {
      artist: "LegendsArt",
      title: "Righteous Cover",
      likes: 15632,
      type: "design"
    }
  ]

  const socialStats = [
    { platform: "Instagram", icon: Instagram, followers: "2.4M", color: "text-pink-400" },
    { platform: "TikTok", icon: Video, followers: "3.1M", color: "text-white" },
    { platform: "Twitter", icon: Twitter, followers: "1.8M", color: "text-blue-400" }
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
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  whileHover={{ borderColor: 'rgba(106, 13, 173, 0.5)' }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-green-400 rounded-full flex items-center justify-center font-bold text-white">
                      {testimonial.avatar}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white font-semibold">{testimonial.name}</h4>
                        <span className="text-gray-400 text-sm">{testimonial.location}</span>
                      </div>

                      <div className="flex items-center gap-1 mb-3">
                        {[...Array(testimonial.rating)].map((_, i) => (
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
                        "{testimonial.message}"
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-accent text-sm font-semibold">
                          Purchased: {testimonial.product}
                        </span>

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
              ))}
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
              {fanArt.map((art, index) => (
                <motion.div
                  key={index}
                  className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden hover:border-accent/50 transition-all duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {/* Art Preview */}
                  <div className="aspect-video bg-gradient-to-br from-purple-600 via-blue-500 to-green-400 relative overflow-hidden">
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
                        <p className="text-gray-400">by @{art.artist}</p>
                      </div>

                      <motion.div
                        className="flex items-center gap-2"
                        whileHover={{ scale: 1.05 }}
                      >
                        <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                        <span className="text-white font-semibold">
                          {art.likes.toLocaleString()}
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
              ))}
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