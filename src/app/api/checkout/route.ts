import { NextRequest, NextResponse } from 'next/server'
import { stripe, formatAmountForStripe } from '../../../../lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, shippingAddress, billingAddress } = body

    // Calculate total from cart items
    const subtotal = items.reduce((sum: number, item: any) =>
      sum + (item.price * item.quantity), 0)

    const shipping = subtotal >= 75 ? 0 : 9.99
    const total = subtotal + shipping

    // Validate minimum amount (Stripe requires at least $0.50)
    if (total < 0.50) {
      return NextResponse.json(
        { error: 'Order total must be at least $0.50' },
        { status: 400 }
      )
    }

    // Demo mode for development
    if (process.env.STRIPE_SECRET_KEY === 'demo') {
      return NextResponse.json({
        clientSecret: 'pi_demo_client_secret_123456789',
        paymentIntentId: 'pi_demo_123456789',
        amount: total,
        demo: true
      })
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(total),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderType: 'juice_wrld_merchandise',
        itemCount: items.length.toString(),
        subtotal: subtotal.toString(),
        shipping: shipping.toString(),
      },
      shipping: shippingAddress ? {
        name: shippingAddress.name,
        address: {
          line1: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.zipCode,
          country: 'US',
        },
      } : undefined,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: total,
    })

  } catch (error) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}