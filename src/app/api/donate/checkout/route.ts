import { NextRequest, NextResponse } from 'next/server'
import { stripe, formatAmountForStripe } from '../../../../../lib/stripe'

// Deliberately no Order record and no shipping/tax -- a donation isn't a
// purchase of anything, there's nothing to fulfill or ship. Same
// lightweight shape as the digital_unlock payment path: a bare
// PaymentIntent the webhook recognizes by metadata.type and otherwise
// leaves alone (see src/app/api/stripe/webhook/route.ts).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const amount = Number(body?.amount)

    if (!Number.isFinite(amount) || amount < 1 || amount > 1000) {
      return NextResponse.json({ error: 'Enter an amount between $1 and $1000' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { type: 'donation' }
    })

    return NextResponse.json({ clientSecret: paymentIntent.client_secret })
  } catch (error) {
    console.error('Error creating donation payment intent:', error)
    return NextResponse.json({ error: 'Failed to start donation' }, { status: 500 })
  }
}
