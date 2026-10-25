import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyPreOrderCancelToken } from '../../../../../lib/preorderToken'
import { cancelPreOrderAndRefund } from '../../../../../lib/preorderCancel'

// No-login self-serve cancel -- the signed token (mailed in the overdue
// notice, see lib/preorderOverdue.ts) is the only credential, same trust
// model as the balance-payment magic link. GET shows what they're about
// to cancel; POST actually does it.
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('orderId') || ''
  const token = request.nextUrl.searchParams.get('token') || ''

  if (!orderId || !token || !verifyPreOrderCancelToken(token, orderId)) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } }
  })
  if (!order || !order.isPreOrder) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: order.status,
    productName: order.items[0]?.product.name || 'your item',
    depositAmount: order.depositAmount,
    shipByDate: order.shipByDate ? order.shipByDate.toISOString() : null
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
    const token = typeof body?.token === 'string' ? body.token : ''

    if (!orderId || !token || !verifyPreOrderCancelToken(token, orderId)) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
    }

    const result = await cancelPreOrderAndRefund(orderId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, refundedAmount: result.refundedAmount })
  } catch (error) {
    console.error('Error processing self-serve pre-order cancellation:', error)
    return NextResponse.json({ error: 'Failed to cancel and refund' }, { status: 500 })
  }
}
