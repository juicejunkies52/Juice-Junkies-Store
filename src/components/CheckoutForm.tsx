'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  useStripe,
  useElements,
  PaymentElement,
  AddressElement,
} from '@stripe/react-stripe-js'
import { useCart } from '@/contexts/CartContext'

export default function CheckoutForm() {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const { clearCart } = useCart()

  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!stripe) return

    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    )

    if (!clientSecret) return

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      if (!paymentIntent) return

      switch (paymentIntent.status) {
        case 'succeeded':
          setMessage('Payment succeeded!')
          break
        case 'processing':
          setMessage('Your payment is processing.')
          break
        case 'requires_payment_method':
          setMessage('Your payment was not successful, please try again.')
          break
        default:
          setMessage('Something went wrong.')
          break
      }
    })
  }, [stripe])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order/success`,
        receipt_email: email,
      },
    })

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message || 'An error occurred')
      } else {
        setMessage('An unexpected error occurred.')
      }
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment succeeded
      clearCart()
      router.push('/order/success')
    }

    setIsLoading(false)
  }

  const paymentElementOptions = {
    layout: 'tabs' as const,
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-accent focus:outline-none transition-colors"
          placeholder="juice@999.com"
        />
      </div>

      {/* Shipping Address */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-4">Shipping Address</h3>
        <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-700">
          <AddressElement
            options={{
              mode: 'shipping',
              allowedCountries: ['US'],
              autocomplete: {
                mode: 'google_maps_api',
              },
            }}
          />
        </div>
      </div>

      {/* Payment Method */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-4">Payment Method</h3>
        <div className="bg-gray-900/30 rounded-lg p-4 border border-gray-700">
          <PaymentElement options={paymentElementOptions} />
        </div>
      </div>

      {/* Error Message */}
      {message && (
        <motion.div
          className="p-4 rounded-lg bg-red-900/20 border border-red-500/50 text-red-300 text-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {message}
        </motion.div>
      )}

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className={`w-full py-4 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
          isLoading || !stripe || !elements
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-green-400 hover:from-purple-500 hover:to-green-300 text-white neon-glow'
        }`}
        whileHover={!isLoading && stripe && elements ? { scale: 1.02 } : {}}
        whileTap={!isLoading && stripe && elements ? { scale: 0.98 } : {}}
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          'Complete Purchase'
        )}
      </motion.button>

      {/* Terms */}
      <p className="text-xs text-gray-400 text-center">
        By completing this purchase you agree to our{' '}
        <a href="/terms" className="text-accent hover:underline">Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>
      </p>
    </motion.form>
  )
}