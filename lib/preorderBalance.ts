import { prisma } from './prisma'
import { stripe, formatAmountForStripe } from './stripe'
import { calculateTax } from '../src/lib/tax'
import { calculateShipping } from '../src/lib/shipping'
import { signPreOrderBalanceToken } from './preorderToken'
import { sendPreOrderBalanceDueEmail } from './email'
import { trackEmailResult } from './emailDeliveryTracking'

interface BalanceRequestResult {
  ok: boolean
  error?: string
  emailSent?: boolean
  payUrl?: string
}

// Shared by the single-order "Send Balance-Due Email" admin action and the
// bulk "End Pre-Order (All)" toggle -- one reservation's worth of work,
// callable either one at a time or in a loop. Never charges a card itself;
// it only creates the PaymentIntent and emails the customer a link to pay
// it themselves, same model the user picked (deposit now, email link later).
export async function sendPreOrderBalanceRequest(orderId: string): Promise<BalanceRequestResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } }
  })
  if (!order || !order.isPreOrder) {
    return { ok: false, error: 'Not a pre-order' }
  }
  if (order.status !== 'deposit_paid') {
    return { ok: false, error: `Order is '${order.status}', not ready for a balance request` }
  }
  if (!order.customerEmail) {
    return { ok: false, error: 'No email on file for this reservation' }
  }

  const merchandiseBalance = order.balanceDue || 0
  const shippingCost = calculateShipping(merchandiseBalance, 'standard')
  const taxCalculation = calculateTax(merchandiseBalance, shippingCost)
  const chargeAmount = taxCalculation.total

  if (chargeAmount < 0.5) {
    return { ok: false, error: 'Remaining balance is below the $0.50 Stripe minimum' }
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
  await trackEmailResult(order.id, result)

  return { ok: true, emailSent: result.sent, payUrl }
}
