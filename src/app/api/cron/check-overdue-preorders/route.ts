import { NextRequest, NextResponse } from 'next/server'
import { checkAndNotifyOverduePreOrders } from '../../../../../lib/preorderOverdue'

// Invoked daily by Vercel Cron (see vercel.json). Not under /api/admin, so
// it isn't covered by the admin-token cookie gate in src/middleware.ts --
// a cron invocation carries no browser cookies. Protected instead by the
// Authorization header Vercel sends when CRON_SECRET is configured, which
// must be set in the project's env vars for this route to accept requests.
export async function GET(request: NextRequest) {
  // TEMPORARY diagnostic -- reveals nothing secret, just whether the env
  // var exists in this running deployment and how long it is, to debug why
  // the real auth check below keeps failing. Removing this immediately
  // after use.
  if (request.nextUrl.searchParams.get('debug') === 'jj999') {
    return NextResponse.json({
      hasSecret: !!process.env.CRON_SECRET,
      secretLength: process.env.CRON_SECRET?.length ?? 0
    })
  }

  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkAndNotifyOverduePreOrders()
    console.log('⏰ Overdue pre-order check:', result)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error running overdue pre-order check:', error)
    return NextResponse.json({ error: 'Failed to check overdue pre-orders' }, { status: 500 })
  }
}
