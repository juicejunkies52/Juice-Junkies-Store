'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Zap,
  X,
  AlertTriangle
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
  isPreOrder: boolean
  depositAmount: number | null
  balanceDue: number | null
  balanceRequestedAt: string | null
  shipByDate: string | null
  cancelledAt: string | null
  refundedAmount: number | null
  customerEmail: string | null
  emailDeliveryFailed: boolean
  emailDeliveryError: string | null
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
  const [balanceRequestLoading, setBalanceRequestLoading] = useState(false)
  const [balanceRequestMessage, setBalanceRequestMessage] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelMessage, setCancelMessage] = useState('')

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

  const sendBalanceRequest = async () => {
    if (!order) return

    setBalanceRequestLoading(true)
    setBalanceRequestMessage('')
    try {
      const response = await fetch('/api/admin/preorder/send-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      })
      const result = await response.json()

      if (response.ok) {
        setOrder({ ...order, balanceRequestedAt: new Date().toISOString() })
        setBalanceRequestMessage(result.emailSent ? 'Balance-due email sent.' : 'Payment link created, but the email did not send -- check RESEND_API_KEY.')
      } else {
        setBalanceRequestMessage(result.error || 'Failed to send balance request')
      }
    } catch (error) {
      console.error('Error sending balance request:', error)
      setBalanceRequestMessage('Failed to send balance request')
    } finally {
      setBalanceRequestLoading(false)
    }
  }

  const cancelAndRefund = async () => {
    if (!order) return

    setCancelLoading(true)
    setCancelMessage('')
    try {
      const response = await fetch('/api/admin/preorder/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      })
      const result = await response.json()

      if (response.ok) {
        setOrder({ ...order, status: 'cancelled', cancelledAt: new Date().toISOString(), refundedAmount: result.refundedAmount })
        setCancelMessage(result.emailSent ? `Refunded $${result.refundedAmount.toFixed(2)} and emailed the customer.` : `Refunded $${result.refundedAmount.toFixed(2)}, but the email did not send.`)
        setCancelModalOpen(false)
      } else {
        setCancelMessage(result.error || 'Failed to cancel and refund')
      }
    } catch (error) {
      console.error('Error cancelling pre-order:', error)
      setCancelMessage('Failed to cancel and refund')
    } finally {
      setCancelLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/20'
      case 'paid':
        return 'text-green-400 bg-green-400/20'
      case 'deposit_paid':
        return 'text-accent bg-accent/20'
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
        {order.emailDeliveryFailed && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
            <div>
              <p className="text-sm font-medium text-yellow-500">An email to this customer failed to send</p>
              {order.emailDeliveryError && <p className="mt-1 text-xs text-yellow-500/70">{order.emailDeliveryError}</p>}
              <p className="mt-1 text-xs text-gray-400">They may not know what&apos;s happening with this order -- worth reaching out directly.</p>
            </div>
          </div>
        )}
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

            {/* Pre-order reservation */}
            {order.isPreOrder && (
              <motion.div
                className="bg-black/30 backdrop-blur-sm rounded-xl border border-accent/30 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="mb-4 text-xl font-bold text-white">Pre-Order Reservation</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Deposit paid</div>
                    <div className="font-medium text-white">${order.depositAmount?.toFixed(2) ?? '--'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Balance due</div>
                    <div className="font-medium text-white">${order.balanceDue?.toFixed(2) ?? '--'}</div>
                  </div>
                  {order.shipByDate && (
                    <div className="col-span-2">
                      <div className="text-gray-400">Ship by</div>
                      <div className={`font-medium ${new Date(order.shipByDate) < new Date() && order.status !== 'paid' && order.status !== 'cancelled' ? 'text-red-400' : 'text-white'}`}>
                        {new Date(order.shipByDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        {new Date(order.shipByDate) < new Date() && order.status !== 'paid' && order.status !== 'cancelled' && ' -- overdue'}
                      </div>
                    </div>
                  )}
                </div>

                {order.status === 'cancelled' && (
                  <div className="mt-4 border-t border-gray-700 pt-4 text-sm text-gray-400">
                    Cancelled {order.cancelledAt ? new Date(order.cancelledAt).toLocaleDateString() : ''} -- refunded ${order.refundedAmount?.toFixed(2) ?? '0.00'}.
                  </div>
                )}

                {order.status === 'deposit_paid' && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    {order.balanceRequestedAt ? (
                      <p className="text-sm text-gray-400">
                        Balance request sent {new Date(order.balanceRequestedAt).toLocaleDateString()}. Resend if the
                        customer lost the email.
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Deposit is in -- send the balance-due email once this is actually ready to ship.
                      </p>
                    )}
                    <button
                      onClick={sendBalanceRequest}
                      disabled={balanceRequestLoading || !order.customerEmail}
                      className="mt-3 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-black transition-colors hover:bg-accent/80 disabled:opacity-50"
                    >
                      <Zap className={`h-4 w-4 ${balanceRequestLoading ? 'animate-spin' : ''}`} />
                      {order.balanceRequestedAt ? 'Resend Balance-Due Email' : 'Send Balance-Due Email'}
                    </button>
                    {!order.customerEmail && <p className="mt-2 text-xs text-yellow-500">No email on file for this reservation.</p>}
                    {balanceRequestMessage && <p className="mt-2 text-xs text-gray-400">{balanceRequestMessage}</p>}
                  </div>
                )}

                {order.status === 'paid' && order.fulfillmentStatus === 'unfulfilled' && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <p className="text-sm text-yellow-500">
                      Balance is fully paid, but this isn&apos;t sent to Printful yet on purpose -- Printful charges your
                      own payment method the moment you confirm production, separate from whether this Stripe payment
                      has actually paid out to your bank yet. Make sure Printful is funded, then use the Fulfill Order
                      button below.
                    </p>
                  </div>
                )}

                {(order.status === 'pending' || order.status === 'deposit_paid') && (
                  <div className="mt-4 border-t border-gray-700 pt-4">
                    <button
                      onClick={() => setCancelModalOpen(true)}
                      className="flex items-center gap-2 rounded-lg border border-red-500/50 px-4 py-2 text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel &amp; Refund Deposit
                    </button>
                    {cancelMessage && <p className="mt-2 text-xs text-gray-400">{cancelMessage}</p>}
                  </div>
                )}
              </motion.div>
            )}

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

      <AnimatePresence>
        {cancelModalOpen && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !cancelLoading && setCancelModalOpen(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-xl border border-red-500/30 bg-black/90 p-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-5 h-5" />
                  <h2 className="font-bold text-white">Cancel &amp; Refund</h2>
                </div>
                <button onClick={() => setCancelModalOpen(false)} className="text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mb-4 text-sm text-white/80">
                This refunds the ${order?.depositAmount?.toFixed(2) ?? '0.00'} deposit back to the customer's original
                payment method and marks this reservation cancelled. This can't be undone.
              </p>
              <button
                onClick={cancelAndRefund}
                disabled={cancelLoading}
                className="w-full rounded-lg bg-red-500 py-3 font-semibold text-white hover:bg-red-400 disabled:opacity-50"
              >
                {cancelLoading ? 'Refunding...' : `Refund $${order?.depositAmount?.toFixed(2) ?? '0.00'} & Cancel`}
              </button>
              {cancelMessage && <p className="mt-3 text-xs text-red-400">{cancelMessage}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}