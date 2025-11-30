'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Heart,
  ArrowLeft,
  Check,
  X,
  Star,
  Eye,
  Search,
  Music
} from 'lucide-react'
import Link from 'next/link'

interface Memory {
  id: string
  name?: string
  location?: string
  memory: string
  favoriteSong?: string
  memoryType: string
  isAnonymous: boolean
  isApproved: boolean
  isFeatured: boolean
  createdAt: string
}

export default function MemoriesManagement() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchMemories()
  }, [])

  const fetchMemories = async () => {
    try {
      const response = await fetch('/api/admin/memories')
      const data = await response.json()
      if (data.success) {
        setMemories(data.memories)
      }
    } catch (error) {
      console.error('Failed to fetch memories:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateMemory = async (id: string, updates: Partial<Memory>) => {
    try {
      const response = await fetch(`/api/admin/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        setMemories(prev =>
          prev.map(m => m.id === id ? { ...m, ...updates } : m)
        )
      }
    } catch (error) {
      console.error('Failed to update memory:', error)
    }
  }

  const filteredMemories = memories.filter(memory => {
    const matchesFilter = filter === 'all' ||
      (filter === 'pending' && !memory.isApproved) ||
      (filter === 'approved' && memory.isApproved) ||
      (filter === 'featured' && memory.isFeatured)

    const matchesSearch = !searchTerm ||
      memory.memory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memory.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memory.favoriteSong?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesFilter && matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading memories...</p>
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
                <h1 className="text-3xl font-bold text-white">Memorial Wall</h1>
                <p className="text-gray-400 mt-1">Review and moderate fan memories</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search memories..."
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
                <option value="all">All Memories</option>
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
                <p className="text-2xl font-bold text-white">{memories.length}</p>
              </div>
              <Heart className="w-8 h-8 text-red-400" />
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
                  {memories.filter(m => !m.isApproved).length}
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
                  {memories.filter(m => m.isApproved).length}
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
                  {memories.filter(m => m.isFeatured).length}
                </p>
              </div>
              <Star className="w-8 h-8 text-purple-400" />
            </div>
          </motion.div>
        </div>

        {/* Memories Grid */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {filteredMemories.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Heart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No memories found</h3>
              <p className="text-gray-400">Fan memories will appear here for review</p>
            </div>
          ) : (
            filteredMemories.map((memory) => (
              <motion.div
                key={memory.id}
                className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-medium">
                      {memory.isAnonymous ? 'Anonymous' : memory.name || 'Anonymous'}
                    </h3>
                    {memory.location && (
                      <p className="text-gray-400 text-sm">{memory.location}</p>
                    )}
                    <div className="mt-1">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        memory.memoryType === 'concert' ? 'bg-blue-400/20 text-blue-400' :
                        memory.memoryType === 'personal' ? 'bg-green-400/20 text-green-400' :
                        memory.memoryType === 'tribute' ? 'bg-purple-400/20 text-purple-400' :
                        'bg-gray-400/20 text-gray-400'
                      }`}>
                        {memory.memoryType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Memory Content */}
                <div className="mb-4">
                  <p className="text-gray-300 leading-relaxed">{memory.memory}</p>
                  {memory.favoriteSong && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
                      <Music className="w-4 h-4 text-accent" />
                      <span className="text-sm text-accent">Favorite Song: {memory.favoriteSong}</span>
                    </div>
                  )}
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 mb-4">
                  {memory.isApproved && (
                    <span className="px-2 py-1 bg-green-400/20 text-green-400 text-xs rounded-full">
                      Approved
                    </span>
                  )}
                  {memory.isFeatured && (
                    <span className="px-2 py-1 bg-purple-400/20 text-purple-400 text-xs rounded-full">
                      Featured
                    </span>
                  )}
                  {!memory.isApproved && (
                    <span className="px-2 py-1 bg-yellow-400/20 text-yellow-400 text-xs rounded-full">
                      Pending Review
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!memory.isApproved && (
                    <button
                      onClick={() => updateMemory(memory.id, { isApproved: true })}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Approve
                    </button>
                  )}

                  <button
                    onClick={() => updateMemory(memory.id, { isFeatured: !memory.isFeatured })}
                    className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
                      memory.isFeatured
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    <Star className="w-3 h-3" />
                    {memory.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>

                  {memory.isApproved && (
                    <button
                      onClick={() => updateMemory(memory.id, { isApproved: false })}
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
                    Submitted {new Date(memory.createdAt).toLocaleDateString()}
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