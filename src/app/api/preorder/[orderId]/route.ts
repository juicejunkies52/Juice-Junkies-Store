import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Public-safe summary for the post-checkout confirmation page -- an order
// id alone (a cuid, not guessable) is treated as enough to view this one
// summary, same trust level as a Stripe receipt URL. Exposes only what's
// needed to show "you're reserved for X, owe Y" -- no address, no payment
// intent ids, nothing else from the order.
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
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
    balanceDue: order.balanceDue,
    shipEstimate: order.items[0]?.product.preOrderShipEstimate || null
  })
}
