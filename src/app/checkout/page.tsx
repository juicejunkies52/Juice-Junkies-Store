'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { ArrowLeft, Lock, CreditCard } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { getStripe } from '../../../lib/stripe'
import AnimatedBackground from '@/components/AnimatedBackground'
import CheckoutForm from '@/components/CheckoutForm'
import OrderSummary from '@/components/OrderSummary'

const stripePromise = getStripe()

// Demo checkout form for development
function DemoCheckoutForm() {
  const router = useRouter()
  const { clearCart } = useCart()

  const handleDemoPayment = () => {
    // Simulate successful payment
    clearCart()
    router.push('/order/success?demo=true')
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
        <h3 className="text-yellow-400 font-semibold mb-2">Demo Mode</h3>
        <p className="text-yellow-300 text-sm">
          This is a demo checkout. No real payment will be processed.
        </p>
      </div>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
        />
        <input
          type="email"
          placeholder="Email Address"
          className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
        />
        <input
          type="text"
          placeholder="4242 4242 4242 4242"
          className="w-full p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
          disabled
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="MM/YY"
            className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
            disabled
          />
          <input
            type="text"
            placeholder="CVC"
            className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white"
            disabled
          />
        </div>
      </div>

      <button
        onClick={handleDemoPayment}
        className="w-full bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-300"
      >
        Complete Demo Order
      </button>
    </div>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const { state } = useCart()
  const [clientSecret, setClientSecret] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Redirect if cart is empty
  useEffect(() => {
    if (state.items.length === 0) {
      router.push('/')
      return
    }
  }, [state.items, router])

  useEffect(() => {
    const createPaymentIntent = async () => {
      if (state.items.length === 0) return

      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: state.items,
            shippingAddress: null, // Will be collected in checkout form
            billingAddress: null,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create payment intent')
        }

        const data = await response.json()
        setClientSecret(data.clientSecret || 'demo')
      } catch (error) {
        console.error('Error creating payment intent:', error)
      } finally {
        setLoading(false)
      }
    }

    createPaymentIntent()
  }, [state.items])

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <AnimatedBackground />
        <motion.div
          className="text-accent text-6xl font-bold"
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.95, 1.05, 0.95]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          999
        </motion.div>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <AnimatedBackground />
        <div className="text-center">
          <h1 className="text-2xl text-white mb-4">Unable to process checkout</h1>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#6a0dad',
      colorBackground: '#0a0a0a',
      colorText: '#ffffff',
      colorDanger: '#ef4444',
      borderRadius: '8px',
    },
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-40 min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between p-6 max-w-7xl mx-auto">
          <motion.button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white hover:text-accent transition-colors"
            whileHover={{ x: -5 }}
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Cart
          </motion.button>

          <div className="flex items-center gap-2 text-accent">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-semibold">Secure Checkout</span>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 text-center">
              Checkout
            </h1>
            <p className="text-gray-400 text-center mb-8">
              Complete your purchase securely with Stripe
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Checkout Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCard className="w-6 h-6 text-accent" />
                  <h2 className="text-2xl font-bold text-white">Payment Details</h2>
                </div>

                {clientSecret === 'demo' ? (
                  <DemoCheckoutForm />
                ) : (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance,
                    }}
                  >
                    <CheckoutForm />
                  </Elements>
                )}
              </div>

              {/* Trust Indicators */}
              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                <div className="text-gray-400">
                  <Lock className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-xs">SSL Encrypted</p>
                </div>
                <div className="text-gray-400">
                  <CreditCard className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-xs">Stripe Secure</p>
                </div>
                <div className="text-gray-400">
                  <div className="w-6 h-6 mx-auto mb-2 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-black text-xs font-bold">999</span>
                  </div>
                  <p className="text-xs">Official Store</p>
                </div>
              </div>
            </motion.div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <OrderSummary />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}