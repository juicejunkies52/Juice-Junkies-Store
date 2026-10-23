'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, X, CheckCircle2 } from 'lucide-react'
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { getStripe } from '../../lib/stripe'

// Rotates for personality while the modal sits open -- genuinely funny
// broke-artist humor plus the real ask, not JUST jokes, so it doesn't
// read as a bit that undersells why donating actually matters.
const QUOTES = [
  "We're currently funding this site with vibes and hope.",
  'Every dollar helps us afford more pixels for the butterflies.',
  "The server bill doesn't pay itself (we've checked, repeatedly).",
  'Help us keep bringing you the content and products you deserve.',
  "This isn't a scam, we're just build broke and dream rich.",
  'Buy us a coffee so we can stay up fixing bugs at 3am.',
  'Juice Junkies runs on love, caffeine, and the occasional donation.'
]

function DonationForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setIsLoading(true)
    setMessage(null)

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required'
    })

    if (result.error) {
      setMessage(result.error.message || 'Something went wrong -- please try again.')
      setIsLoading(false)
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {message && <p className="text-xs text-red-400">{message}</p>}
      <button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-red-500 py-3 font-semibold text-white transition-opacity disabled:opacity-50"
      >
        {isLoading ? 'Processing...' : 'Donate'}
      </button>
    </form>
  )
}

export default function DonationButton() {
  const [open, setOpen] = useState(false)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [amount, setAmount] = useState(5)
  const [customAmount, setCustomAmount] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [stripePromise, setStripePromise] = useState<any>(null)

  useEffect(() => {
    const initializeStripe = async () => {
      const stripeInstance = await getStripe()
      setStripePromise(stripeInstance)
    }
    initializeStripe()
  }, [])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setQuoteIndex((i) => (i + 1) % QUOTES.length), 4000)
    return () => clearInterval(id)
  }, [open])

  const effectiveAmount = customAmount ? parseFloat(customAmount) || 0 : amount

  const startCheckout = async () => {
    if (effectiveAmount < 1) return
    setLoading(true)
    setClientSecret('')
    try {
      const res = await fetch('/api/donate/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: effectiveAmount })
      })
      const data = await res.json()
      if (res.ok) setClientSecret(data.clientSecret)
    } finally {
      setLoading(false)
    }
  }

  const close = () => {
    setOpen(false)
    setClientSecret('')
    setDone(false)
    setCustomAmount('')
  }

  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#ec4899',
      colorBackground: '#0a0a0a',
      colorText: '#ffffff',
      borderRadius: '8px'
    }
  }

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-red-500 text-white shadow-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Support the site"
      >
        <Heart className="h-5 w-5" fill="currentColor" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              className="w-full max-w-sm rounded-xl border border-pink-500/30 bg-black/90 p-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-pink-400">
                  <Heart className="h-5 w-5" fill="currentColor" />
                  <h2 className="font-bold text-white">Support Juice Junkies</h2>
                </div>
                <button onClick={close} className="text-white/50 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {done ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-pink-400" />
                  <p className="text-white">You're the real MVP. Thank you!</p>
                  <button onClick={close} className="btn-primary mt-4">
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={quoteIndex}
                      className="mb-4 min-h-[2.5rem] text-sm text-white/60"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                    >
                      {QUOTES[quoteIndex]}
                    </motion.p>
                  </AnimatePresence>

                  {!clientSecret ? (
                    <>
                      <div className="mb-3 grid grid-cols-4 gap-2">
                        {[3, 5, 10, 20].map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              setAmount(v)
                              setCustomAmount('')
                            }}
                            className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${
                              !customAmount && amount === v
                                ? 'border-pink-500 bg-pink-500/20 text-pink-300'
                                : 'border-white/15 text-white/70 hover:border-white/30'
                            }`}
                          >
                            ${v}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Custom amount"
                        className="mb-4 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:border-pink-500 focus:outline-none"
                      />
                      <button
                        onClick={startCheckout}
                        disabled={loading || effectiveAmount < 1}
                        className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-red-500 py-3 font-semibold text-white disabled:opacity-50"
                      >
                        {loading ? 'Loading...' : `Donate $${effectiveAmount.toFixed(2)}`}
                      </button>
                    </>
                  ) : stripePromise ? (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                      <DonationForm onSuccess={() => setDone(true)} />
                    </Elements>
                  ) : (
                    <p className="text-center text-sm text-white/50">Loading payment form...</p>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
