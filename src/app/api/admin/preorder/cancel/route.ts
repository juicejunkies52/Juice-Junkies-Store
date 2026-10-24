import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { stripe } from '../../../../../../lib/stripe'
import { sendPreOrderCancelledEmail } from '../../../../../../lib/email'

// Admin-triggered cancellation of a reservation that hasn't shipped (and
// never will, from here). Only valid while status is 'pending' or
// 'deposit_paid' -- once the balance is paid (status 'paid'), Printful
// fulfillment may already be in motion and this simple path no longer
// applies; that case needs to be handled manually against Printful's own
// dashboard instead.
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
    if (order.status !== 'pending' && order.status !== 'deposit_paid') {
      return NextResponse.json({ error: `Order is '${order.status}' -- can't cancel from here` }, { status: 400 })
    }
    if (!order.stripePaymentIntentId) {
      return NextResponse.json({ error: 'No deposit payment found on this order' }, { status: 400 })
    }

    const refund = await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId })
    const refundedAmount = refund.amount / 100

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        refundedAmount
      }
    })

    const firstItem = order.items[0]
    let emailSent = false
    if (order.customerEmail) {
      const result = await sendPreOrderCancelledEmail({
        orderId: order.id,
        customerEmail: order.customerEmail,
        productName: firstItem?.product.name || 'your item',
        refundAmount: refundedAmount
      })
      emailSent = result.sent
    }

    return NextResponse.json({ ok: true, refundedAmount, emailSent })
  } catch (error) {
    console.error('Error cancelling pre-order:', error)
    return NextResponse.json({ error: 'Failed to cancel and refund' }, { status: 500 })
  }
}
