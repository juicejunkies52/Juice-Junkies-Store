import { prisma } from './prisma'
import { stripe } from './stripe'
import { sendPreOrderCancelledEmail } from './email'

interface CancelResult {
  ok: boolean
  error?: string
  refundedAmount?: number
  emailSent?: boolean
}

// Shared by the admin-triggered cancel button and the customer self-serve
// cancel link in the overdue-notice email -- same restrictions either way:
// only valid while status is 'pending' or 'deposit_paid'. Once the balance
// is paid (status 'paid'), Printful fulfillment may already be in motion
// and this simple path no longer applies -- that needs manual handling
// against Printful's own dashboard instead.
export async function cancelPreOrderAndRefund(orderId: string): Promise<CancelResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } }
  })
  if (!order || !order.isPreOrder) {
    return { ok: false, error: 'Not a pre-order' }
  }
  if (order.status !== 'pending' && order.status !== 'deposit_paid') {
    return { ok: false, error: `Order is '${order.status}' -- can't cancel from here` }
  }
  if (!order.stripePaymentIntentId) {
    return { ok: false, error: 'No deposit payment found on this order' }
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

  return { ok: true, refundedAmount, emailSent }
}
