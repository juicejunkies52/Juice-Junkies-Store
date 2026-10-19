import { NextRequest, NextResponse } from 'next/server'
import { stripe, formatAmountForStripe } from '../../../../../lib/stripe'
import { getCurrentUser } from '../../../../../lib/userAuth'
import { prisma } from '../../../../../lib/prisma'

// Paid digital extras live here -- keyed by feature name so new ones can
// be added without a new route. Price is server-side only; the client
// never gets to say what it should cost.
const DIGITAL_FEATURES: Record<string, { price: number; label: string }> = {
  'neon-sketch': { price: 5, label: 'Neon Sketch' },
  'hooded-character': { price: 9.99, label: '999 Zombie' }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const feature = typeof body?.feature === 'string' ? body.feature : ''
  const config = DIGITAL_FEATURES[feature]
  if (!config) {
    return NextResponse.json({ error: 'Unknown feature' }, { status: 400 })
  }

  const existing = await prisma.digitalUnlock.findUnique({
    where: { userId_feature: { userId: user.id, feature } }
  })
  if (existing) {
    return NextResponse.json({ error: 'Already unlocked' }, { status: 409 })
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(config.price),
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    receipt_email: user.email,
    metadata: {
      type: 'digital_unlock',
      userId: user.id,
      feature
    }
  })

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, amount: config.price, label: config.label })
}
