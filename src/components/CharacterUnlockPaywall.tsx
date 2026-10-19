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
    <form onSubmit={handleSubmit} className="space-y-4" data-destroy-ui>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white disabled:opacity-50 transition-all"
      >
        {submitting ? 'Processing...' : 'Pay $9.99 -- Unlock 999 Zombie'}
      </button>
    </form>
  )
}

export default function CharacterUnlockPaywall({ onUnlocked, onClose }: { onUnlocked: () => void; onClose: () => void }) {
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
        body: JSON.stringify({ feature: 'hooded-character' })
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
    <div data-destroy-ui className="mx-auto max-w-sm rounded-xl border border-accent/30 bg-black/90 p-6 text-center">
      <button onClick={onClose} className="float-right text-white/50 hover:text-white">
        ✕
      </button>
      <h3 className="text-lg font-bold text-accent">🧟 999 Zombie</h3>
      <p className="mt-2 text-sm text-white/70">
        Unlock the exclusive 999 Zombie character skin -- usable in Smash Juice Junkies and 999 Last Stand. One-time
        $9.99, yours forever on this account.
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
          {loading ? 'Loading...' : '$9.99 -- Unlock 999 Zombie'}
        </button>
      )}
    </div>
  )
}
