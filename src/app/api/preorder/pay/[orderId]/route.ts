import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { stripe } from '../../../../../../lib/stripe'
import { verifyPreOrderBalanceToken } from '../../../../../../lib/preorderToken'

// No-login balance-payment lookup -- the signed token (mailed to the
// customer, see /api/admin/preorder/send-balance) is the only credential,
// same trust model as any other "magic link." Returns the clientSecret
// for the PaymentIntent that was already created when the admin sent the
// email, so the Elements form on the page can mount directly.
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const token = request.nextUrl.searchParams.get('token') || ''

  if (!token || !verifyPreOrderBalanceToken(token, orderId)) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } }
  })
  if (!order || !order.isPreOrder) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (order.status === 'paid') {
    return NextResponse.json({ alreadyPaid: true, productName: order.items[0]?.product.name || 'your item' })
  }

  if (order.status !== 'deposit_paid' || !order.balancePaymentIntentId) {
    return NextResponse.json({ error: 'This reservation is not ready for balance payment yet' }, { status: 400 })
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(order.balancePaymentIntentId)

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    productName: order.items[0]?.product.name || 'your item',
    balanceAmount: order.totalAmount - (order.depositAmount || 0),
    customerEmail: order.customerEmail
  })
}
