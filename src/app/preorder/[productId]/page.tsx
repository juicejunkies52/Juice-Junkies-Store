'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { Lock, ArrowLeft } from 'lucide-react'
import { getStripe } from '../../../../lib/stripe'
import AnimatedBackground from '../../../components/AnimatedBackground'

// Deliberately its own small form rather than reusing CheckoutForm -- a
// pre-order deposit collects no shipping address (that's gathered later,
// at the balance-payment step once there's actually something to ship),
// so it doesn't need the AddressElement or cart-clearing logic at all.
function PreOrderDepositForm({ orderId }: { orderId: string }) {
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
        return_url: `${window.location.origin}/preorder-confirmed/${orderId}`,
        receipt_email: email
      }
    })

    if (result.error) {
      setMessage(result.error.message || 'Something went wrong -- please try again.')
      setIsLoading(false)
      return
    }
    router.push(`/preorder-confirmed/${orderId}`)
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
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
          className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-400 transition-colors focus:border-accent focus:outline-none"
          placeholder="juice@999.com"
        />
        <p className="mt-1 text-xs text-gray-500">We'll send your reservation confirmation and the balance-due link here.</p>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-white">Payment Method</h3>
        <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>
      </div>

      {message && (
        <motion.div
          className="rounded-lg border border-red-500/50 bg-red-900/20 p-4 text-sm text-red-300"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {message}
        </motion.div>
      )}

      <motion.button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className={`flex w-full items-center justify-center gap-3 rounded-lg py-4 text-lg font-semibold transition-all duration-300 ${
          isLoading || !stripe || !elements
            ? 'cursor-not-allowed bg-gray-600 text-gray-400'
            : 'bg-gradient-to-r from-accent to-yellow-400 text-black hover:shadow-lg'
        }`}
        whileHover={!isLoading && stripe && elements ? { scale: 1.02 } : {}}
        whileTap={!isLoading && stripe && elements ? { scale: 0.98 } : {}}
      >
        {isLoading ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            Processing...
          </>
        ) : (
          'Reserve My Spot'
        )}
      </motion.button>

      <p className="text-center text-xs text-gray-400">
        This charges only the deposit shown above. We'll email you a separate link to pay the remaining balance once it's
        ready to ship. By reserving, you agree to our{' '}
        <a href="/terms" className="text-accent hover:underline">
          Terms of Service
        </a>
        .
      </p>
    </motion.form>
  )
}

export default function PreOrderPage() {
  const { productId } = useParams()
  const router = useRouter()
  const [clientSecret, setClientSecret] = useState('')
  const [orderId, setOrderId] = useState('')
  const [summary, setSummary] = useState<{
    deposit: number
    balanceDue: number
    fullPrice: number
    shipEstimate: string | null
  } | null>(null)
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
    if (!productId) return
    ;(async () => {
      try {
        const res = await fetch('/api/preorder/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId })
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'This product is not open for pre-order right now.')
          return
        }
        setClientSecret(data.clientSecret)
        setOrderId(data.orderId)
        setSummary({ deposit: data.deposit, balanceDue: data.balanceDue, fullPrice: data.fullPrice, shipEstimate: data.shipEstimate })
      } catch {
        setError('Something went wrong starting your pre-order. Please try again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [productId])

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#39ff14',
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

  if (error || !clientSecret || !summary) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <div className="text-center">
          <h1 className="mb-4 text-2xl text-white">{error || 'Unable to start pre-order'}</h1>
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
        <header className="mx-auto flex max-w-3xl items-center justify-between p-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
          <div className="flex items-center gap-2 text-accent">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-semibold">Secure Checkout</span>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="mb-2 text-center text-4xl font-bold text-white md:text-5xl">Reserve Your Pre-Order</h1>
            <p className="mb-8 text-center text-gray-400">Official launch collection -- pay a small deposit to secure yours</p>
          </motion.div>

          <div className="mb-8 rounded-xl border border-accent/30 bg-accent/5 p-6">
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>Deposit due now</span>
              <span className="text-2xl font-bold text-accent">${summary.deposit.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
              <span>Remaining balance (paid later, before it ships)</span>
              <span>${summary.balanceDue.toFixed(2)}</span>
            </div>
            {summary.shipEstimate && <p className="mt-3 text-xs text-white/40">Estimated: {summary.shipEstimate}</p>}
          </div>

          <div className="rounded-xl border border-gray-800 bg-black/20 p-8 backdrop-blur-sm">
            {stripePromise && clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                <PreOrderDepositForm orderId={orderId} />
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
