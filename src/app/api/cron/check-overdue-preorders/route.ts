import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { checkAndNotifyOverduePreOrders } from '../../../../../lib/preorderOverdue'

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12)

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
    const authHeader = request.headers.get('authorization')
    const envSecret = process.env.CRON_SECRET
    return NextResponse.json({
      hasSecret: !!envSecret,
      secretLength: envSecret?.length ?? 0,
      secretHash: envSecret ? hash(envSecret) : null,
      authHeaderReceived: !!authHeader,
      authHeaderLength: authHeader?.length ?? 0,
      authHeaderHash: authHeader ? hash(authHeader) : null,
      expectedHeaderHash: envSecret ? hash(`Bearer ${envSecret}`) : null
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
