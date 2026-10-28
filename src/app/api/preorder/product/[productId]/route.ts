import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { getDailyPreOrderCapStatus } from '../../../../../../lib/preorderCap'

// Side-effect-free lookup the deposit-amount picker calls before any order
// or PaymentIntent exists -- lets the page show the minimum deposit and
// price without creating a throwaway order every time someone just loads
// the page (the old flow created one immediately on page load).
export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, price: true, preOrderMode: true, preOrderDeposit: true, preOrderShipEstimate: true, preOrderShipBy: true }
  })

  if (!product || !product.preOrderMode || !product.preOrderDeposit || product.preOrderDeposit < 0.5) {
    return NextResponse.json({ error: 'This product is not open for pre-order right now.' }, { status: 400 })
  }

  const capStatus = await getDailyPreOrderCapStatus()

  return NextResponse.json({
    productId: product.id,
    name: product.name,
    price: product.price,
    minDeposit: product.preOrderDeposit,
    shipEstimate: product.preOrderShipEstimate || null,
    shipByDate: product.preOrderShipBy ? product.preOrderShipBy.toISOString() : null,
    capReached: capStatus.capReached,
    capResetsAt: capStatus.resetsAt
  })
}
