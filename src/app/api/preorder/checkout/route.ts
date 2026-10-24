import { NextRequest, NextResponse } from 'next/server'
import { stripe, formatAmountForStripe } from '../../../../../lib/stripe'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Deliberately isolated from /api/checkout -- a pre-order deposit is a
// completely different transaction shape (single product, no cart, no
// shipping address yet, charges only the deposit) and the two should
// never share a code path that a bug in one could leak into the other.
//
// Tax and shipping are NOT charged here -- they're computed against the
// FULL order total once a real shipping address exists, at the balance-
// payment step (see /api/preorder/balance, task #17). balanceDue stored
// here is just the remaining merchandise cost (price - deposit); the
// actual balance PaymentIntent amount gets tax/shipping added on top when
// it's created.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const productId = typeof body?.productId === 'string' ? body.productId : ''
    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (!product.preOrderMode || !product.preOrderDeposit || product.preOrderDeposit < 0.5) {
      return NextResponse.json({ error: 'This product is not open for pre-order' }, { status: 400 })
    }

    // The admin-set deposit is a floor, not a fixed amount -- a customer can
    // choose to pay more now to owe less at the balance step. Falls back to
    // the minimum if nothing (or something invalid) was sent, so the old
    // {productId}-only request shape still works.
    const requestedDeposit = typeof body?.depositAmount === 'number' ? body.depositAmount : undefined
    const deposit = requestedDeposit && requestedDeposit > product.preOrderDeposit
      ? Math.min(requestedDeposit, product.price)
      : product.preOrderDeposit
    const balanceDue = Math.max(0, product.price - deposit)

    // Attaches to an account when signed in, same as normal checkout;
    // guest pre-orders work too (the balance-due email is what they'll
    // use to get back in, no login required).
    const user = await getCurrentUser(request)

    const order = await prisma.order.create({
      data: {
        userId: user?.id,
        status: 'pending',
        totalAmount: product.price,
        shippingAddress: '{}',
        billingAddress: '{}',
        isPreOrder: true,
        depositAmount: deposit,
        balanceDue,
        shipByDate: product.preOrderShipBy,
        items: {
          create: [{ productId: product.id, quantity: 1, price: product.price }]
        }
      }
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(deposit),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderType: 'preorder_deposit',
        orderId: order.id,
        productId: product.id,
        productName: product.name
      }
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntent.id }
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      deposit,
      balanceDue,
      fullPrice: product.price,
      shipEstimate: product.preOrderShipEstimate || null,
      shipByDate: product.preOrderShipBy ? product.preOrderShipBy.toISOString() : null
    })
  } catch (error) {
    console.error('Error creating pre-order deposit:', error)
    return NextResponse.json({ error: 'Failed to start pre-order' }, { status: 500 })
  }
}
