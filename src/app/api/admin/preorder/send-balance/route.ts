import { NextRequest, NextResponse } from 'next/server'
import { sendPreOrderBalanceRequest } from '../../../../../../lib/preorderBalance'

// Admin-triggered for a single reservation. The same underlying logic also
// runs in bulk from src/app/api/admin/products/bulk-preorder/route.ts when
// an admin ends a drop -- see lib/preorderBalance.ts. Protected by
// src/middleware.ts's global /api/admin/* gate, same as every other admin route.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const result = await sendPreOrderBalanceRequest(orderId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, emailSent: result.emailSent, payUrl: result.payUrl })
  } catch (error) {
    console.error('Error sending pre-order balance request:', error)
    return NextResponse.json({ error: 'Failed to send balance request' }, { status: 500 })
  }
}
