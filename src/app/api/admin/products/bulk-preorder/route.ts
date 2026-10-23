import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { sendPreOrderBalanceRequest } from '../../../../../../lib/preorderBalance'

// Flips every product in/out of pre-order mode at once, for launching or
// ending the drop in one click. Individual per-product toggles on the
// products page still work afterward for fine-tuning.
//
// Ending the drop (enabled: false) also processes every outstanding
// reservation: each deposit-paid pre-order gets its balance-due PaymentIntent
// created and its magic-link email sent right away, same as clicking "Send
// Balance-Due Email" on each order individually -- this just does all of
// them at once instead of one at a time. It never charges a card itself;
// the customer still has to open the email and pay the remaining balance.
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

    let balanceRequestsSent = 0
    let balanceRequestsFailed = 0
    const failures: { orderId: string; error?: string }[] = []

    if (!enabled) {
      const pendingReservations = await prisma.order.findMany({
        where: { isPreOrder: true, status: 'deposit_paid' },
        select: { id: true }
      })

      for (const reservation of pendingReservations) {
        try {
          const result = await sendPreOrderBalanceRequest(reservation.id)
          if (result.ok) {
            balanceRequestsSent++
          } else {
            balanceRequestsFailed++
            failures.push({ orderId: reservation.id, error: result.error })
          }
        } catch (error) {
          balanceRequestsFailed++
          failures.push({ orderId: reservation.id, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }
    }

    const count = await prisma.product.count()
    return NextResponse.json({ success: true, updated: count, balanceRequestsSent, balanceRequestsFailed, failures })
  } catch (error) {
    console.error('Failed to bulk update pre-order mode:', error)
    return NextResponse.json({ error: 'Failed to update products' }, { status: 500 })
  }
}
