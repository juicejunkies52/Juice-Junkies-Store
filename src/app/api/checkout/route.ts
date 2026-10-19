import { NextRequest, NextResponse } from 'next/server'
import { stripe, formatAmountForStripe } from '../../../../lib/stripe'
import { calculateTax, createTaxCalculationForStripe } from '../../../lib/tax'
import { calculateShipping, isShippingMethod, SHIPPING_METHODS } from '../../../lib/shipping'
import { prisma } from '../../../../lib/prisma'
import { getCurrentUser } from '../../../../lib/userAuth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, shippingAddress, billingAddress } = body
    const shippingMethod = isShippingMethod(body.shippingMethod) ? body.shippingMethod : 'standard'

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }

    // Calculate total from cart items
    const subtotal = items.reduce((sum: number, item: any) =>
      sum + (item.price * item.quantity), 0)

    const shipping = calculateShipping(subtotal, shippingMethod)

    // Calculate tax based on shipping address
    const taxCalculation = calculateTax(subtotal, shipping, shippingAddress)
    const total = taxCalculation.total

    // Validate minimum amount (Stripe requires at least $0.50)
    if (total < 0.50) {
      return NextResponse.json(
        { error: 'Order total must be at least $0.50' },
        { status: 400 }
      )
    }

    // Create the order record before charging the card, so the payment can
    // always be traced back to a real order and its line items. Shipping
    // address is usually not known yet at this point (collected via the
    // Address Element during payment confirmation) and gets filled in by
    // the webhook once the payment succeeds.
    // Attaches the order to an account when someone's signed in while
    // checking out; stays null for guest checkout, which keeps working
    // exactly as before -- login is never required to buy anything.
    const user = await getCurrentUser(request)

    const order = await prisma.order.create({
      data: {
        userId: user?.id,
        totalAmount: total,
        shippingAddress: JSON.stringify(shippingAddress || {}),
        billingAddress: JSON.stringify(billingAddress || shippingAddress || {}),
        shippingMethod,
        shippingAmount: shipping,
        status: 'pending',
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
            price: item.price
          }))
        }
      }
    })

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(total),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId: order.id,
        orderType: 'juice_wrld_merchandise',
        itemCount: items.length.toString(),
        subtotal: subtotal.toString(),
        shipping: shipping.toString(),
        shippingMethod,
        tax: taxCalculation.taxAmount.toString(),
        taxRate: taxCalculation.taxRate.toString(),
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

    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntent.id }
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId: order.id,
      amount: total,
      tax: {
        amount: taxCalculation.taxAmount,
        rate: taxCalculation.taxRate,
        subtotal: taxCalculation.subtotal,
        shipping: shipping,
        shippingMethod,
        total: total
      }
    })

  } catch (error) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}