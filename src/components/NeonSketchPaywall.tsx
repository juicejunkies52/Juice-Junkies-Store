'use client'

import { useState } from 'react'
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { getStripe } from '../../lib/stripe'

function PaymentForm({ onUnlocked }: { onUnlocked: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required'
    })

    if (result.error) {
      setError(result.error.message || 'Payment failed')
      setSubmitting(false)
      return
    }

    if (result.paymentIntent?.status === 'succeeded') {
      // The webhook is what actually grants the unlock (confirmed
      // server-side via Stripe), so give it a moment to land before
      // telling the parent to re-check status.
      setTimeout(onUnlocked, 1500)
    } else {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white disabled:opacity-50 transition-all"
      >
        {submitting ? 'Processing...' : 'Pay $5 -- Unlock Neon Sketch'}
      </button>
    </form>
  )
}

export default function NeonSketchPaywall({ onUnlocked }: { onUnlocked: () => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const startCheckout = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/digital/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'neon-sketch' })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not start checkout')
        return
      }
      setClientSecret(data.clientSecret)
    } catch {
      setError('Could not start checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-accent/30 bg-black/70 p-6 text-center">
      <h3 className="text-lg font-bold text-accent">🖊️ Neon Sketch</h3>
      <p className="mt-2 text-sm text-white/70">
        Unlock a glowing neon canvas to draw on your decoration background -- pick colors, doodle
        whatever you want. One-time $5, yours forever on this account.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {clientSecret ? (
        <div className="mt-4 text-left">
          <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <PaymentForm onUnlocked={onUnlocked} />
          </Elements>
        </div>
      ) : (
        <button
          onClick={startCheckout}
          disabled={loading}
          className="mt-4 w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white disabled:opacity-50 transition-all"
        >
          {loading ? 'Loading...' : '$5 -- Unlock Neon Sketch'}
        </button>
      )}
    </div>
  )
}
