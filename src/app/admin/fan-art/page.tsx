'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Image as ImageIcon,
  ArrowLeft,
  Check,
  X,
  Star,
  Eye,
  Search
} from 'lucide-react'
import Link from 'next/link'

interface FanArt {
  id: string
  artistName: string
  title: string
  type: string
  description?: string
  socialHandle?: string
  url: string
  isApproved: boolean
  isFeatured: boolean
  likes: number
  createdAt: string
}

export default function FanArtManagement() {
  const [fanArt, setFanArt] = useState<FanArt[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchFanArt()
  }, [])

  const fetchFanArt = async () => {
    try {
      const response = await fetch('/api/admin/fan-art')
      const data = await response.json()
      if (data.success) {
        setFanArt(data.fanArt)
      }
    } catch (error) {
      console.error('Failed to fetch fan art:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateFanArt = async (id: string, updates: Partial<FanArt>) => {
    try {
      const response = await fetch(`/api/admin/fan-art/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        setFanArt(prev =>
          prev.map(a => a.id === id ? { ...a, ...updates } : a)
        )
      }
    } catch (error) {
      console.error('Failed to update fan art:', error)
    }
  }

  const filteredFanArt = fanArt.filter(art => {
    const matchesFilter = filter === 'all' ||
      (filter === 'pending' && !art.isApproved) ||
      (filter === 'approved' && art.isApproved) ||
      (filter === 'featured' && art.isFeatured)

    const matchesSearch = !searchTerm ||
      art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.artistName.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesFilter && matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading fan art...</p>
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
                <h1 className="text-3xl font-bold text-white">Fan Art</h1>
                <p className="text-gray-400 mt-1">Approve community artwork submissions</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search fan art..."
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
                <option value="all">All Fan Art</option>
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
                <p className="text-2xl font-bold text-white">{fanArt.length}</p>
              </div>
              <ImageIcon className="w-8 h-8 text-blue-400" />
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
                  {fanArt.filter(a => !a.isApproved).length}
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
                  {fanArt.filter(a => a.isApproved).length}
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
                  {fanArt.filter(a => a.isFeatured).length}
                </p>
              </div>
              <Star className="w-8 h-8 text-purple-400" />
            </div>
          </motion.div>
        </div>

        {/* Fan Art Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {filteredFanArt.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <ImageIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No fan art found</h3>
              <p className="text-gray-400">Fan art submissions will appear here for review</p>
            </div>
          ) : (
            filteredFanArt.map((art) => (
              <motion.div
                key={art.id}
                className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Image */}
                <div className="aspect-video bg-gray-900">
                  <img
                    src={art.url}
                    alt={art.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-4">
                  {/* Header */}
                  <div className="mb-3">
                    <h3 className="text-white font-medium">{art.title}</h3>
                    <p className="text-gray-400 text-sm">
                      by {art.artistName}
                      {art.socialHandle && ` (${art.socialHandle})`}
                    </p>
                    <span className="inline-block mt-1 px-2 py-1 text-xs rounded-full bg-gray-400/20 text-gray-400">
                      {art.type}
                    </span>
                  </div>

                  {art.description && (
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">{art.description}</p>
                  )}

                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mb-4">
                    {art.isApproved && (
                      <span className="px-2 py-1 bg-green-400/20 text-green-400 text-xs rounded-full">
                        Approved
                      </span>
                    )}
                    {art.isFeatured && (
                      <span className="px-2 py-1 bg-purple-400/20 text-purple-400 text-xs rounded-full">
                        Featured
                      </span>
                    )}
                    {!art.isApproved && (
                      <span className="px-2 py-1 bg-yellow-400/20 text-yellow-400 text-xs rounded-full">
                        Pending Review
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!art.isApproved && (
                      <button
                        onClick={() => updateFanArt(art.id, { isApproved: true })}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                    )}

                    <button
                      onClick={() => updateFanArt(art.id, { isFeatured: !art.isFeatured })}
                      className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
                        art.isFeatured
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }`}
                    >
                      <Star className="w-3 h-3" />
                      {art.isFeatured ? 'Unfeature' : 'Feature'}
                    </button>

                    {art.isApproved && (
                      <button
                        onClick={() => updateFanArt(art.id, { isApproved: false })}
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
                      Submitted {new Date(art.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </main>
    </div>
  )
}
