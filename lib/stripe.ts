import { loadStripe } from '@stripe/stripe-js'
import Stripe from 'stripe'

// Client-side Stripe
export const getStripe = () => {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  if (!publishableKey) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined')
  }

  // Demo mode - return null to skip Stripe initialization
  if (publishableKey === 'demo') {
    return null
  }

  return loadStripe(publishableKey)
}

// Server-side Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const formatAmountForStripe = (amount: number): number => {
  return Math.round(amount * 100) // Convert to cents
}

export const formatAmountFromStripe = (amount: number): number => {
  return amount / 100 // Convert from cents
}