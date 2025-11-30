'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star, ArrowLeft, Check, X, Mail, Phone, Search } from 'lucide-react'
import Link from 'next/link'

interface EarlyAccess {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  size: string
  notifications: boolean
  status: string
  createdAt: string
}

export default function EarlyAccessManagement() {
  const [signups, setSignups] = useState<EarlyAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchSignups()
  }, [])

  const fetchSignups = async () => {
    try {
      const response = await fetch('/api/admin/early-access')
      const data = await response.json()
      if (data.success) {
        setSignups(data.signups)
      }
    } catch (error) {
      console.error('Failed to fetch early access signups:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSignups = signups.filter(signup => {
    const matchesFilter = filter === 'all' ||
      (filter === 'pending' && signup.status === 'pending') ||
      (filter === 'approved' && signup.status === 'approved') ||
      (filter === 'notified' && signup.status === 'notified')

    const matchesSearch = !searchTerm ||
      `${signup.firstName} ${signup.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signup.email.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesFilter && matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading early access list...</p>
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
                <h1 className="text-3xl font-bold text-white">Early Access List</h1>
                <p className="text-gray-400 mt-1">Manage VIP early access members</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search signups..."
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
                <option value="all">All Signups</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="notified">Notified</option>
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
                <p className="text-gray-400 text-sm">Total Signups</p>
                <p className="text-2xl font-bold text-white">{signups.length}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-400" />
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
                  {signups.filter(s => s.status === 'pending').length}
                </p>
              </div>
              <X className="w-8 h-8 text-yellow-400" />
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
                  {signups.filter(s => s.status === 'approved').length}
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
                <p className="text-gray-400 text-sm">Notified</p>
                <p className="text-2xl font-bold text-blue-400">
                  {signups.filter(s => s.status === 'notified').length}
                </p>
              </div>
              <Mail className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>
        </div>

        {/* Signups Table */}
        <motion.div
          className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {filteredSignups.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No signups found</h3>
              <p className="text-gray-400">Early access signups will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Notifications
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Signed Up
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredSignups.map((signup) => (
                    <motion.tr
                      key={signup.id}
                      className="hover:bg-black/20 transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">
                          {signup.firstName} {signup.lastName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          <div className="flex items-center gap-1 mb-1">
                            <Mail className="w-3 h-3" />
                            {signup.email}
                          </div>
                          {signup.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {signup.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                          {signup.size}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          signup.status === 'pending' ? 'bg-yellow-400/20 text-yellow-400' :
                          signup.status === 'approved' ? 'bg-green-400/20 text-green-400' :
                          signup.status === 'notified' ? 'bg-blue-400/20 text-blue-400' :
                          'bg-gray-400/20 text-gray-400'
                        }`}>
                          {signup.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          signup.notifications ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'
                        }`}>
                          {signup.notifications ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          {new Date(signup.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(signup.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}