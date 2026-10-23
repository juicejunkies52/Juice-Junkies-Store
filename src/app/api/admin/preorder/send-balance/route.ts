import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { stripe, formatAmountForStripe } from '../../../../../../lib/stripe'
import { calculateTax } from '../../../../../lib/tax'
import { calculateShipping } from '../../../../../lib/shipping'
import { signPreOrderBalanceToken } from '../../../../../../lib/preorderToken'
import { sendPreOrderBalanceDueEmail } from '../../../../../../lib/email'

// Admin-triggered, one reservation at a time (deliberately no bulk-by-
// product action -- a solo admin reviewing a drop should look at what
// they're sending balance requests for, not fire-and-forget hundreds of
// charges at once). Protected by src/middleware.ts's global /api/admin/*
// gate, same as every other admin route.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } }
    })
    if (!order || !order.isPreOrder) {
      return NextResponse.json({ error: 'Not a pre-order' }, { status: 400 })
    }
    if (order.status !== 'deposit_paid') {
      return NextResponse.json({ error: `Order is '${order.status}', not ready for a balance request` }, { status: 400 })
    }
    if (!order.customerEmail) {
      return NextResponse.json({ error: 'No email on file for this reservation' }, { status: 400 })
    }

    const merchandiseBalance = order.balanceDue || 0
    // Same simplification the main checkout flow already uses -- no real
    // shipping address exists yet at this point (that's collected on the
    // balance-payment page itself), so tax/shipping are calculated the
    // identical way /api/checkout does before it has one.
    const shippingCost = calculateShipping(merchandiseBalance, 'standard')
    const taxCalculation = calculateTax(merchandiseBalance, shippingCost)
    const chargeAmount = taxCalculation.total

    if (chargeAmount < 0.5) {
      return NextResponse.json({ error: 'Remaining balance is below the $0.50 Stripe minimum' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(chargeAmount),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderType: 'preorder_balance',
        orderId: order.id
      }
    })

    const token = signPreOrderBalanceToken(order.id)

    await prisma.order.update({
      where: { id: order.id },
      data: {
        balanceRequestedAt: new Date(),
        balancePaymentIntentId: paymentIntent.id,
        // Reconciled now that a real charge amount exists -- was just the
        // deposit + a placeholder balanceDue snapshot until this point.
        totalAmount: (order.depositAmount || 0) + chargeAmount
      }
    })

    const firstItem = order.items[0]
    const payUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://juicejunkies.shop'}/preorder/pay/${order.id}?token=${token}`

    const result = await sendPreOrderBalanceDueEmail({
      orderId: order.id,
      customerEmail: order.customerEmail,
      productName: firstItem?.product.name || 'your item',
      balanceAmount: chargeAmount,
      payUrl
    })

    return NextResponse.json({ ok: true, emailSent: result.sent, payUrl })
  } catch (error) {
    console.error('Error sending pre-order balance request:', error)
    return NextResponse.json({ error: 'Failed to send balance request' }, { status: 500 })
  }
}
