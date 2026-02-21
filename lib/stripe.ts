import { loadStripe } from '@stripe/stripe-js'
import Stripe from 'stripe'

// Client-side Stripe
export const getStripe = () => {
  // Check if we're on the client side
  if (typeof window === 'undefined') {
    return null
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined')
  }

  return loadStripe(publishableKey)
}

// Server-side Stripe - Lazy initialization
let stripeInstance: Stripe | null = null

export const getStripeInstance = (): Stripe => {
  // Only run on server side
  if (typeof window !== 'undefined') {
    throw new Error('getStripeInstance should only be called on the server side')
  }

  if (!stripeInstance) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is missing. Available env vars:', Object.keys(process.env).filter(k => k.includes('STRIPE')))
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables')
    }

    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
    })
  }

  return stripeInstance
}

// Server-side only proxy for backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    return (getStripeInstance() as any)[prop]
  }
})

export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100) // Convert to cents
}

export const formatAmountFromStripe = (amount: number): number => {
  return amount / 100 // Convert from cents
}