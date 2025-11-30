'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MapPin,
  CreditCard,
  Zap
} from 'lucide-react'
import Link from 'next/link'

interface OrderDetails {
  id: string
  userId: string | null
  status: string
  fulfillmentStatus: string
  totalAmount: number
  shippingAddress: any
  billingAddress: any
  createdAt: string
  updatedAt: string
  printfulOrderId?: string
  trackingNumber?: string
  trackingUrl?: string
  shippedAt?: string
  estimatedDelivery?: string
  items: {
    id: string
    quantity: number
    price: number
    product: {
      id: string
      name: string
      images: string
      fulfillmentType: string
    }
    variant?: {
      id: string
      size?: string
      color?: string
    }
  }[]
  user?: {
    id: string
    name?: string
    email: string
  }
}

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [fulfillLoading, setFulfillLoading] = useState(false)

  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  useEffect(() => {
    if (resolvedParams?.id) {
      fetchOrder(resolvedParams.id)
    }
  }, [resolvedParams])

  const fetchOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`)
      const data = await response.json()
      if (data.success) {
        setOrder(data.order)
      }
    } catch (error) {
      console.error('Failed to fetch order:', error)
    } finally {
      setLoading(false)
    }
  }

  const fulfillOrder = async () => {
    if (!order) return

    setFulfillLoading(true)
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/fulfill`, {
        method: 'POST'
      })
      const result = await response.json()

      if (result.success) {
        setOrder({ ...order, fulfillmentStatus: 'pending' })
      } else {
        console.error('Fulfillment failed:', result.error)
      }
    } catch (error) {
      console.error('Error fulfilling order:', error)
    } finally {
      setFulfillLoading(false)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Order not found</h2>
          <Link
            href="/admin/orders"
            className="text-accent hover:text-accent/80 transition-colors"
          >
            Back to orders
          </Link>
        </div>
      </div>
    )
  }

  const shippingAddr = JSON.parse(order.shippingAddress)
  const billingAddr = JSON.parse(order.billingAddress)

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
                href="/admin/orders"
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Order #{order.id.slice(-8).toUpperCase()}
                </h1>
                <p className="text-gray-400 mt-1">
                  Placed on {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                {order.status}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getFulfillmentColor(order.fulfillmentStatus)}`}>
                {order.fulfillmentStatus}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Order Items</h2>
                {order.fulfillmentStatus === 'unfulfilled' && order.status === 'paid' && (
                  <button
                    onClick={fulfillOrder}
                    disabled={fulfillLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Zap className={`w-4 h-4 ${fulfillLoading ? 'animate-spin' : ''}`} />
                    Fulfill Order
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {order.items.map((item) => {
                  const images = JSON.parse(item.product.images)
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-4 bg-black/20 rounded-lg">
                      <div className="w-16 h-16 bg-gray-700 rounded-lg overflow-hidden">
                        {images[0] && (
                          <img
                            src={images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{item.product.name}</h3>
                        {item.variant && (
                          <div className="text-gray-400 text-sm">
                            {item.variant.size && `Size: ${item.variant.size}`}
                            {item.variant.color && ` • Color: ${item.variant.color}`}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span>Qty: {item.quantity}</span>
                          <span>•</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                            item.product.fulfillmentType === 'printful'
                              ? 'bg-cyan-400/20 text-cyan-400'
                              : 'bg-orange-400/20 text-orange-400'
                          }`}>
                            {item.product.fulfillmentType === 'printful' ? (
                              <>
                                <Zap className="w-3 h-3" />
                                Print-on-demand
                              </>
                            ) : (
                              <>
                                <Package className="w-3 h-3" />
                                Manual fulfillment
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">${item.price.toFixed(2)}</div>
                        <div className="text-gray-400 text-sm">
                          ${(item.price * item.quantity).toFixed(2)} total
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-white">Total</span>
                  <span className="text-2xl font-bold text-accent">${order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>

            {/* Tracking Info */}
            {(order.trackingNumber || order.printfulOrderId) && (
              <motion.div
                className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Fulfillment Details
                </h3>
                <div className="space-y-3">
                  {order.printfulOrderId && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Printful Order ID:</span>
                      <span className="text-white">{order.printfulOrderId}</span>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tracking Number:</span>
                      <span className="text-cyan-400">{order.trackingNumber}</span>
                    </div>
                  )}
                  {order.shippedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Shipped:</span>
                      <span className="text-white">
                        {new Date(order.shippedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {order.estimatedDelivery && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Est. Delivery:</span>
                      <span className="text-white">
                        {new Date(order.estimatedDelivery).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Customer & Address Info */}
          <div className="space-y-6">
            {/* Customer */}
            <motion.div
              className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer
              </h3>
              <div className="space-y-2">
                {order.user ? (
                  <>
                    <div className="text-white font-medium">{order.user.name || 'Guest'}</div>
                    <div className="text-gray-400">{order.user.email}</div>
                  </>
                ) : (
                  <div className="text-gray-400">Guest checkout</div>
                )}
              </div>
            </motion.div>

            {/* Shipping Address */}
            <motion.div
              className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Shipping Address
              </h3>
              <div className="space-y-1 text-gray-300">
                <div>{shippingAddr.name}</div>
                <div>{shippingAddr.address}</div>
                {shippingAddr.address2 && <div>{shippingAddr.address2}</div>}
                <div>
                  {shippingAddr.city}, {shippingAddr.state} {shippingAddr.zipCode}
                </div>
                <div>{shippingAddr.country}</div>
                {shippingAddr.phone && <div>{shippingAddr.phone}</div>}
              </div>
            </motion.div>

            {/* Billing Address */}
            <motion.div
              className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Billing Address
              </h3>
              <div className="space-y-1 text-gray-300">
                <div>{billingAddr.name}</div>
                <div>{billingAddr.address}</div>
                {billingAddr.address2 && <div>{billingAddr.address2}</div>}
                <div>
                  {billingAddr.city}, {billingAddr.state} {billingAddr.zipCode}
                </div>
                <div>{billingAddr.country}</div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  )
}