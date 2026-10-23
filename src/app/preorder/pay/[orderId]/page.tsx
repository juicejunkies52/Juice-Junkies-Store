'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Elements, useStripe, useElements, PaymentElement, AddressElement } from '@stripe/react-stripe-js'
import { Lock, CheckCircle2 } from 'lucide-react'
import { getStripe } from '../../../../../lib/stripe'
import AnimatedBackground from '../../../../components/AnimatedBackground'

// Collects the shipping address here (not at deposit time) -- this is the
// first point a pre-order actually needs one. Stripe auto-attaches the
// AddressElement's value to the PaymentIntent's .shipping field on
// confirm as long as both live in the same Elements instance, same as
// CheckoutForm.tsx; the webhook's preorder_balance handler reads it from
// there exactly like the normal order flow does.
function BalancePaymentForm({ orderId }: { orderId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!stripe || !elements) return

    setIsLoading(true)
    setMessage(null)

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order/success`,
        receipt_email: email
      }
    })

    if (result.error) {
      setMessage(result.error.message || 'Something went wrong -- please try again.')
      setIsLoading(false)
      return
    }
    router.push('/order/success')
  }

  return (
    <motion.form onSubmit={handleSubmit} className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-white">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-400 focus:border-accent focus:outline-none"
          placeholder="juice@999.com"
        />
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-white">Shipping Address</h3>
        <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
          <AddressElement options={{ mode: 'shipping', allowedCountries: ['US'], autocomplete: { mode: 'automatic' } }} />
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-white">Payment Method</h3>
        <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-red-500/50 bg-red-900/20 p-4 text-sm text-red-300">{message}</div>
      )}

      <motion.button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className={`flex w-full items-center justify-center gap-3 rounded-lg py-4 text-lg font-semibold transition-all duration-300 ${
          isLoading || !stripe || !elements
            ? 'cursor-not-allowed bg-gray-600 text-gray-400'
            : 'bg-gradient-to-r from-purple-600 to-green-400 text-white hover:shadow-lg'
        }`}
        whileHover={!isLoading && stripe && elements ? { scale: 1.02 } : {}}
        whileTap={!isLoading && stripe && elements ? { scale: 0.98 } : {}}
      >
        {isLoading ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Processing...
          </>
        ) : (
          'Complete Order'
        )}
      </motion.button>
    </motion.form>
  )
}

export default function PreOrderPayPage() {
  const { orderId } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') || ''

  const [clientSecret, setClientSecret] = useState('')
  const [productName, setProductName] = useState('')
  const [balanceAmount, setBalanceAmount] = useState(0)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stripePromise, setStripePromise] = useState<any>(null)

  useEffect(() => {
    const initializeStripe = async () => {
      const stripeInstance = await getStripe()
      setStripePromise(stripeInstance)
    }
    initializeStripe()
  }, [])

  useEffect(() => {
    if (!orderId || !token) return
    ;(async () => {
      try {
        const res = await fetch(`/api/preorder/pay/${orderId}?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'This link is invalid or has expired.')
          return
        }
        if (data.alreadyPaid) {
          setAlreadyPaid(true)
          setProductName(data.productName)
          return
        }
        setClientSecret(data.clientSecret)
        setProductName(data.productName)
        setBalanceAmount(data.balanceAmount)
      } catch {
        setError('Something went wrong loading your order. Please try again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId, token])

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#6a0dad',
      colorBackground: '#0a0a0a',
      colorText: '#ffffff',
      colorDanger: '#ef4444',
      borderRadius: '8px'
    }
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <motion.div
          className="text-6xl font-bold text-accent"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          999
        </motion.div>
      </div>
    )
  }

  if (alreadyPaid) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-accent" />
          <h1 className="mb-2 text-2xl text-white">Already paid in full!</h1>
          <p className="mb-6 text-gray-400">{productName} is all set and on its way.</p>
          <button onClick={() => router.push('/')} className="btn-primary">
            Back to the Store
          </button>
        </div>
      </div>
    )
  }

  if (error || !clientSecret) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <div className="text-center">
          <h1 className="mb-4 text-2xl text-white">{error || 'Unable to load this order'}</h1>
          <button onClick={() => router.push('/')} className="btn-primary">
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AnimatedBackground />
      <div className="relative z-40 min-h-screen">
        <header className="mx-auto flex max-w-3xl items-center justify-end p-6">
          <div className="flex items-center gap-2 text-accent">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-semibold">Secure Checkout</span>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="mb-2 text-center text-4xl font-bold text-white md:text-5xl">Complete Your Order</h1>
            <p className="mb-8 text-center text-gray-400">{productName} is ready -- pay the remaining balance to ship it</p>
          </motion.div>

          <div className="mb-8 rounded-xl border border-accent/30 bg-accent/5 p-6">
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>Remaining balance due</span>
              <span className="text-2xl font-bold text-accent">${balanceAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-black/20 p-8 backdrop-blur-sm">
            {stripePromise && clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                <BalancePaymentForm orderId={orderId as string} />
              </Elements>
            ) : (
              <div className="py-8 text-center">
                <p className="text-white">Initializing payment system...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
