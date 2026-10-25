import { NextRequest, NextResponse } from 'next/server'
import { cancelPreOrderAndRefund } from '../../../../../../lib/preorderCancel'

// Admin-triggered cancellation. Same underlying logic also runs from the
// customer-facing self-serve link in the overdue-notice email -- see
// lib/preorderCancel.ts and src/app/api/preorder/cancel/route.ts.
// Protected by src/middleware.ts's global /api/admin/* gate.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const result = await cancelPreOrderAndRefund(orderId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, refundedAmount: result.refundedAmount, emailSent: result.emailSent })
  } catch (error) {
    console.error('Error cancelling pre-order:', error)
    return NextResponse.json({ error: 'Failed to cancel and refund' }, { status: 500 })
  }
}
