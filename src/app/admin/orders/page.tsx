'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MoreHorizontal,
  ArrowLeft,
  Filter
} from 'lucide-react'
import Link from 'next/link'

interface Order {
  id: string
  userId: string | null
  status: string
  fulfillmentStatus: string
  totalAmount: number
  shippingAddress: string
  createdAt: string
  updatedAt: string
  items: {
    id: string
    quantity: number
    price: number
    product: {
      id: string
      name: string
      images: string
    }
    variant?: {
      id: string
      size?: string
      color?: string
    }
  }[]
  printfulOrderId?: string
  trackingNumber?: string
}

export default function OrdersManagement() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/admin/orders')
      const data = await response.json()
      if (data.success) {
        setOrders(data.orders)
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/20'
      case 'paid':
        return 'text-green-400 bg-green-400/20'
      case 'cancelled':
        return 'text-red-400 bg-red-400/20'
      default:
        return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getFulfillmentColor = (status: string) => {
    switch (status) {
      case 'unfulfilled':
        return 'text-red-400 bg-red-400/20'
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/20'
      case 'fulfilled':
        return 'text-green-400 bg-green-400/20'
      default:
        return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />
      case 'paid':
        return <CheckCircle className="w-4 h-4" />
      case 'cancelled':
        return <XCircle className="w-4 h-4" />
      default:
        return <Package className="w-4 h-4" />
    }
  }

  const fulfillOrder = async (orderId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/orders/${orderId}/fulfill`, {
        method: 'POST'
      })
      const result = await response.json()

      if (result.success) {
        await fetchOrders() // Refresh orders
      } else {
        console.error('Fulfillment failed:', result.error)
      }
    } catch (error) {
      console.error('Error fulfilling order:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    if (filter === 'pending') return order.status === 'pending'
    if (filter === 'unfulfilled') return order.fulfillmentStatus === 'unfulfilled'
    if (filter === 'fulfilled') return order.fulfillmentStatus === 'fulfilled'
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading orders...</p>
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
                <h1 className="text-3xl font-bold text-white">Order Management</h1>
                <p className="text-gray-400 mt-1">Process and fulfill customer orders</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Orders</option>
                <option value="pending">Pending Payment</option>
                <option value="unfulfilled">Unfulfilled</option>
                <option value="fulfilled">Fulfilled</option>
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
                <p className="text-gray-400 text-sm">Total Orders</p>
                <p className="text-2xl font-bold text-white">{orders.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-400" />
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
                <p className="text-gray-400 text-sm">Pending Payment</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {orders.filter(o => o.status === 'pending').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
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
                <p className="text-gray-400 text-sm">Unfulfilled</p>
                <p className="text-2xl font-bold text-red-400">
                  {orders.filter(o => o.fulfillmentStatus === 'unfulfilled').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
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
                <p className="text-gray-400 text-sm">Fulfilled</p>
                <p className="text-2xl font-bold text-green-400">
                  {orders.filter(o => o.fulfillmentStatus === 'fulfilled').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </motion.div>
        </div>

        {/* Orders Table */}
        <motion.div
          className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No orders found</h3>
              <p className="text-gray-400">Orders will appear here when customers make purchases</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Fulfillment
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredOrders.map((order) => (
                    <motion.tr
                      key={order.id}
                      className="hover:bg-black/20 transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-white">
                            #{order.id.slice(-8).toUpperCase()}
                          </div>
                          {order.trackingNumber && (
                            <div className="text-xs text-cyan-400 flex items-center gap-1 mt-1">
                              <Truck className="w-3 h-3" />
                              {order.trackingNumber}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getFulfillmentColor(order.fulfillmentStatus)}`}>
                          {order.fulfillmentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-white">
                            {order.items.reduce((acc, item) => acc + item.quantity, 0)} items
                          </div>
                          <div className="text-xs text-gray-400">
                            {order.items.length} products
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">
                          ${order.totalAmount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {order.fulfillmentStatus === 'unfulfilled' && order.status === 'paid' && (
                            <button
                              onClick={() => fulfillOrder(order.id)}
                              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded transition-colors"
                              disabled={loading}
                            >
                              Fulfill
                            </button>
                          )}
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4 text-gray-400" />
                          </Link>
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