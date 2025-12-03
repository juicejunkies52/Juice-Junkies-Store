'use client'

import { useEffect, useState, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Check, ArrowLeft, ShoppingBag, Mail, Truck } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function OrderSuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order')
  const isDemo = searchParams.get('demo') === 'true'
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orderId && !isDemo) {
      fetchOrder()
    } else {
      setLoading(false)
    }
  }, [orderId, isDemo])

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading your order...</p>
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

      {/* Main Content */}
      <main className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <motion.div
          className="max-w-2xl w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Success Icon */}
          <motion.div
            className="text-center mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          >
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Order Confirmed!</h1>
            <p className="text-gray-400 text-lg">
              {isDemo
                ? "Thank you for trying our demo checkout process"
                : "Thank you for your purchase. Your order has been received."
              }
            </p>
          </motion.div>

          {/* Order Details */}
          <motion.div
            className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-8 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {isDemo ? (
              <div className="text-center space-y-4">
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <h3 className="text-yellow-400 font-semibold mb-2">Demo Order</h3>
                  <p className="text-yellow-300 text-sm">
                    This was a demonstration. No real order was placed or payment processed.
                  </p>
                </div>

                <div className="text-left space-y-2">
                  <h3 className="text-white font-semibold">Demo Order Details:</h3>
                  <p className="text-gray-300">Order ID: DEMO-{Date.now()}</p>
                  <p className="text-gray-300">Amount: Demo</p>
                  <p className="text-gray-300">Status: Demo Completed</p>
                </div>
              </div>
            ) : order ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">Order Details</h3>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                    Confirmed
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-gray-300">
                    <span className="text-gray-400">Order ID:</span> #{order.id.slice(-8).toUpperCase()}
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-400">Total:</span> ${order.totalAmount.toFixed(2)}
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-400">Date:</span> {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {order.items && order.items.length > 0 && (
                  <div>
                    <h4 className="text-white font-semibold mb-2">Items Ordered:</h4>
                    <div className="space-y-2">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{item.product.name}</span>
                          <span className="text-gray-400">Qty: {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400">Order details not available</p>
              </div>
            )}
          </motion.div>

          {/* Next Steps */}
          <motion.div
            className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-800 p-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-white font-semibold mb-4">What happens next?</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Confirmation Email</p>
                  <p className="text-gray-400 text-sm">
                    {isDemo
                      ? "In a real order, you'd receive a confirmation email with your order details"
                      : "You'll receive a confirmation email with your order details shortly"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShoppingBag className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Order Processing</p>
                  <p className="text-gray-400 text-sm">
                    {isDemo
                      ? "In a real order, your items would be prepared for shipping"
                      : "Your order is being prepared and will ship within 1-2 business days"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Shipping Updates</p>
                  <p className="text-gray-400 text-sm">
                    {isDemo
                      ? "In a real order, you'd receive tracking information once shipped"
                      : "You'll receive tracking information once your order ships"
                    }
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </Link>
            {!isDemo && (
              <button className="flex-1 py-3 px-6 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-semibold rounded-lg transition-colors">
                View Order Details
              </button>
            )}
          </motion.div>

          {/* Support */}
          <motion.div
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <p className="text-gray-400 text-sm">
              Need help? Contact us at{' '}
              <a href="mailto:support@999store.com" className="text-accent hover:text-accent/80">
                support@999store.com
              </a>
            </p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  )
}