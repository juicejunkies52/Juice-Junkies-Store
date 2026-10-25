import { NextResponse } from 'next/server'
import { checkAndNotifyOverduePreOrders } from '../../../../../../lib/preorderOverdue'

// Manual, admin-triggered run of the same check the daily cron does (see
// src/app/api/cron/check-overdue-preorders) -- lets an admin run it
// on-demand right after setting a ship-by date or spotting a delay,
// instead of waiting for the next scheduled run. Protected by
// src/middleware.ts's global /api/admin/* gate.
export async function POST() {
  try {
    const result = await checkAndNotifyOverduePreOrders()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error running overdue pre-order check:', error)
    return NextResponse.json({ error: 'Failed to check overdue pre-orders' }, { status: 500 })
  }
}
