import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'

// Flips every product in/out of pre-order mode at once, for launching or
// ending the drop in one click. Individual per-product toggles on the
// products page still work afterward for fine-tuning.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const enabled = Boolean(body?.enabled)
    const defaultDeposit = typeof body?.defaultDeposit === 'number' && body.defaultDeposit > 0
      ? body.defaultDeposit
      : undefined
    const defaultShipEstimate = typeof body?.defaultShipEstimate === 'string' && body.defaultShipEstimate.trim()
      ? body.defaultShipEstimate.trim()
      : undefined

    await prisma.product.updateMany({ data: { preOrderMode: enabled } })

    if (enabled && defaultDeposit) {
      await prisma.product.updateMany({
        where: { preOrderDeposit: null },
        data: { preOrderDeposit: defaultDeposit }
      })
    }

    if (enabled && defaultShipEstimate) {
      await prisma.product.updateMany({
        where: { OR: [{ preOrderShipEstimate: null }, { preOrderShipEstimate: '' }] },
        data: { preOrderShipEstimate: defaultShipEstimate }
      })
    }

    const count = await prisma.product.count()
    return NextResponse.json({ success: true, updated: count })
  } catch (error) {
    console.error('Failed to bulk update pre-order mode:', error)
    return NextResponse.json({ error: 'Failed to update products' }, { status: 500 })
  }
}
