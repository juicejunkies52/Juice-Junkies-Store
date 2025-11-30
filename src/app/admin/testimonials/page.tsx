'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare,
  ArrowLeft,
  Check,
  X,
  Star,
  Eye,
  Filter,
  Search
} from 'lucide-react'
import Link from 'next/link'

interface Testimonial {
  id: string
  name?: string
  location?: string
  testimonial: string
  productPurchased?: string
  rating: number
  isAnonymous: boolean
  allowPublic: boolean
  isApproved: boolean
  isFeatured: boolean
  createdAt: string
  updatedAt: string
}

export default function TestimonialsManagement() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchTestimonials()
  }, [])

  const fetchTestimonials = async () => {
    try {
      const response = await fetch('/api/admin/testimonials')
      const data = await response.json()
      if (data.success) {
        setTestimonials(data.testimonials)
      }
    } catch (error) {
      console.error('Failed to fetch testimonials:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateTestimonial = async (id: string, updates: Partial<Testimonial>) => {
    try {
      const response = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        setTestimonials(prev =>
          prev.map(t => t.id === id ? { ...t, ...updates } : t)
        )
      }
    } catch (error) {
      console.error('Failed to update testimonial:', error)
    }
  }

  const filteredTestimonials = testimonials.filter(testimonial => {
    const matchesFilter = filter === 'all' ||
      (filter === 'pending' && !testimonial.isApproved) ||
      (filter === 'approved' && testimonial.isApproved) ||
      (filter === 'featured' && testimonial.isFeatured)

    const matchesSearch = !searchTerm ||
      testimonial.testimonial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      testimonial.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      testimonial.location?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesFilter && matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading testimonials...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-green-900/10" />
      </div>

      {/* Header */}
      <motion.header
        className="relative z-10 border-b border-gray-800 bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/dashboard"
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white">Testimonials</h1>
                <p className="text-gray-400 mt-1">Moderate and approve fan testimonials</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search testimonials..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-black/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-accent"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Testimonials</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="featured">Featured</option>
              </select>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total</p>
                <p className="text-2xl font-bold text-white">{testimonials.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>

          <motion.div
            className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {testimonials.filter(t => !t.isApproved).length}
                </p>
              </div>
              <Eye className="w-8 h-8 text-yellow-400" />
            </div>
          </motion.div>

          <motion.div
            className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Approved</p>
                <p className="text-2xl font-bold text-green-400">
                  {testimonials.filter(t => t.isApproved).length}
                </p>
              </div>
              <Check className="w-8 h-8 text-green-400" />
            </div>
          </motion.div>

          <motion.div
            className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Featured</p>
                <p className="text-2xl font-bold text-purple-400">
                  {testimonials.filter(t => t.isFeatured).length}
                </p>
              </div>
              <Star className="w-8 h-8 text-purple-400" />
            </div>
          </motion.div>
        </div>

        {/* Testimonials Grid */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {filteredTestimonials.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No testimonials found</h3>
              <p className="text-gray-400">Fan testimonials will appear here for review</p>
            </div>
          ) : (
            filteredTestimonials.map((testimonial) => (
              <motion.div
                key={testimonial.id}
                className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-medium">
                      {testimonial.isAnonymous ? 'Anonymous' : testimonial.name || 'Anonymous'}
                    </h3>
                    {testimonial.location && (
                      <p className="text-gray-400 text-sm">{testimonial.location}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < testimonial.rating ? 'text-yellow-400 fill-current' : 'text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Testimonial Content */}
                <div className="mb-4">
                  <p className="text-gray-300 leading-relaxed">{testimonial.testimonial}</p>
                  {testimonial.productPurchased && (
                    <div className="mt-3 px-3 py-1 bg-gray-800 rounded-full inline-block">
                      <span className="text-xs text-gray-400">Product: {testimonial.productPurchased}</span>
                    </div>
                  )}
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 mb-4">
                  {testimonial.isApproved && (
                    <span className="px-2 py-1 bg-green-400/20 text-green-400 text-xs rounded-full">
                      Approved
                    </span>
                  )}
                  {testimonial.isFeatured && (
                    <span className="px-2 py-1 bg-purple-400/20 text-purple-400 text-xs rounded-full">
                      Featured
                    </span>
                  )}
                  {testimonial.allowPublic && (
                    <span className="px-2 py-1 bg-blue-400/20 text-blue-400 text-xs rounded-full">
                      Public
                    </span>
                  )}
                  {!testimonial.isApproved && (
                    <span className="px-2 py-1 bg-yellow-400/20 text-yellow-400 text-xs rounded-full">
                      Pending Review
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!testimonial.isApproved && (
                    <button
                      onClick={() => updateTestimonial(testimonial.id, { isApproved: true })}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Approve
                    </button>
                  )}

                  <button
                    onClick={() => updateTestimonial(testimonial.id, { isFeatured: !testimonial.isFeatured })}
                    className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
                      testimonial.isFeatured
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    <Star className="w-3 h-3" />
                    {testimonial.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>

                  {testimonial.isApproved && (
                    <button
                      onClick={() => updateTestimonial(testimonial.id, { isApproved: false })}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Reject
                    </button>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-500">
                    Submitted {new Date(testimonial.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </main>
    </div>
  )
}