'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  MessageSquare,
  Heart,
  Image,
  Mail,
  Star,
  TrendingUp,
  Clock,
  Package,
  RefreshCw,
  Zap,
  ShoppingBag,
  Truck
} from 'lucide-react'

interface DashboardStats {
  newsletters: number
  earlyAccess: number
  testimonials: { total: number, pending: number }
  memories: { total: number, pending: number }
  fanArt: { total: number, pending: number }
  products: { total: number, printful: number, manual: number }
  orders: { total: number, pending: number, fulfilled: number }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // Fetch stats from multiple endpoints
      const responses = await Promise.all([
        fetch('/api/newsletter'),
        fetch('/api/early-access'),
        fetch('/api/testimonials'),
        fetch('/api/memories'),
        fetch('/api/fan-art'),
        fetch('/api/admin/products'),
        fetch('/api/admin/printful/sync')
      ])

      const [newsletter, earlyAccess, testimonials, memories, fanArt, products, printfulSync] = await Promise.all(
        responses.map(r => r.json())
      )

      setStats({
        newsletters: newsletter.totalSubscribers || 0,
        earlyAccess: earlyAccess.totalSignups || 0,
        testimonials: {
          total: testimonials.stats?.total || 0,
          pending: 0 // We'll need to add pending count to API
        },
        memories: {
          total: memories.stats?.total || 0,
          pending: 0
        },
        fanArt: {
          total: fanArt.stats?.total || 0,
          pending: 0
        },
        products: {
          total: products.products?.length || 0,
          printful: printfulSync.stats?.printfulProducts || 0,
          manual: (products.products?.length || 0) - (printfulSync.stats?.printfulProducts || 0)
        },
        orders: {
          total: 0, // We'll implement order counting later
          pending: 0,
          fulfilled: 0
        }
      })
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ title, value, icon: Icon, color, pending }: {
    title: string
    value: number
    icon: React.ComponentType<{ className?: string }>
    color: string
    pending?: number
  }) => (
    <motion.div
      className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 hover:border-accent/50 transition-all duration-300"
      whileHover={{ y: -5, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {pending !== undefined && pending > 0 && (
            <p className="text-yellow-400 text-xs mt-1">{pending} pending review</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  )

  const QuickAction = ({ title, description, icon: Icon, href, color }: {
    title: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    href: string
    color: string
  }) => (
    <motion.a
      href={href}
      className="block bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 hover:border-accent/50 transition-all duration-300"
      whileHover={{ y: -3, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
          <p className="text-gray-400 text-sm">{description}</p>
        </div>
      </div>
    </motion.a>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading dashboard...</p>
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
            <div>
              <h1 className="text-3xl font-bold text-white">999 Admin Dashboard</h1>
              <p className="text-gray-400 mt-1">Manage community content and submissions</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-semibold">Admin Panel</p>
                <p className="text-gray-400 text-sm">Last updated: {new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Newsletter Subscribers"
            value={stats?.newsletters || 0}
            icon={Mail}
            color="bg-blue-500"
          />
          <StatCard
            title="Early Access Signups"
            value={stats?.earlyAccess || 0}
            icon={Star}
            color="bg-yellow-500"
          />
          <StatCard
            title="Testimonials"
            value={stats?.testimonials.total || 0}
            icon={MessageSquare}
            color="bg-green-500"
            pending={stats?.testimonials.pending}
          />
          <StatCard
            title="Memories Shared"
            value={stats?.memories.total || 0}
            icon={Heart}
            color="bg-red-500"
            pending={stats?.memories.pending}
          />
          <StatCard
            title="Fan Art Submissions"
            value={stats?.fanArt.total || 0}
            icon={Image}
            color="bg-purple-500"
            pending={stats?.fanArt.pending}
          />
          <StatCard
            title="Total Products"
            value={stats?.products.total || 0}
            icon={Package}
            color="bg-indigo-500"
          />
          <StatCard
            title="Print-on-Demand"
            value={stats?.products.printful || 0}
            icon={Zap}
            color="bg-cyan-500"
          />
          <StatCard
            title="Manual Products"
            value={stats?.products.manual || 0}
            icon={ShoppingBag}
            color="bg-orange-500"
          />
        </div>

        {/* Printful Management Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Print-on-Demand</h3>
                  <p className="text-gray-400 text-sm">Manage Printful integration and product sync</p>
                </div>
              </div>
              <motion.button
                onClick={async () => {
                  setLoading(true)
                  try {
                    const response = await fetch('/api/admin/printful/sync', { method: 'POST' })
                    const result = await response.json()
                    if (result.success) {
                      await fetchDashboardStats() // Refresh stats after sync
                    }
                  } catch (error) {
                    console.error('Sync failed:', error)
                  } finally {
                    setLoading(false)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Sync Products
              </motion.button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/20 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Products</p>
                    <p className="text-2xl font-bold text-white">{stats?.products.total || 0}</p>
                  </div>
                  <Package className="w-8 h-8 text-indigo-400" />
                </div>
              </div>
              <div className="bg-black/20 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Printful Products</p>
                    <p className="text-2xl font-bold text-cyan-400">{stats?.products.printful || 0}</p>
                  </div>
                  <Zap className="w-8 h-8 text-cyan-400" />
                </div>
              </div>
              <div className="bg-black/20 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Manual Products</p>
                    <p className="text-2xl font-bold text-orange-400">{stats?.products.manual || 0}</p>
                  </div>
                  <ShoppingBag className="w-8 h-8 text-orange-400" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <QuickAction
              title="Product Management"
              description="Add, edit, and manage store inventory"
              icon={Package}
              href="/admin/products"
              color="bg-blue-600"
            />
            <QuickAction
              title="Review Testimonials"
              description="Moderate and approve fan testimonials"
              icon={MessageSquare}
              href="/admin/testimonials"
              color="bg-green-500"
            />
            <QuickAction
              title="Manage Memories"
              description="Review memorial wall submissions"
              icon={Heart}
              href="/admin/memories"
              color="bg-red-500"
            />
            <QuickAction
              title="Review Fan Art"
              description="Approve community artwork submissions"
              icon={Image}
              href="/admin/fan-art"
              color="bg-purple-500"
            />
            <QuickAction
              title="Newsletter Management"
              description="View subscribers and send campaigns"
              icon={Mail}
              href="/admin/newsletter"
              color="bg-blue-500"
            />
            <QuickAction
              title="Early Access List"
              description="Manage VIP early access members"
              icon={Star}
              href="/admin/early-access"
              color="bg-yellow-500"
            />
            <QuickAction
              title="Analytics"
              description="View detailed community statistics"
              icon={TrendingUp}
              href="/admin/analytics"
              color="bg-indigo-500"
            />
            <QuickAction
              title="Order Management"
              description="Process and fulfill customer orders"
              icon={Truck}
              href="/admin/orders"
              color="bg-gray-600"
            />
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-white mb-6">Recent Activity</h2>
          <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
            <div className="text-center text-gray-400 py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Recent activity feed coming soon...</p>
              <p className="text-sm mt-2">Track new submissions and community interactions</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}