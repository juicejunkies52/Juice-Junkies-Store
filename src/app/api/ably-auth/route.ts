import { NextRequest, NextResponse } from 'next/server'
import Ably from 'ably'

// Mints a short-lived Ably token scoped to one room's channel -- the root
// key itself stays server-side only and is never sent to the browser.
// clientId identifies this connection within the room (host vs guest,
// used for presence); capability is restricted to that one channel.
export async function GET(request: NextRequest) {
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Realtime not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const room = searchParams.get('room')
  const clientId = searchParams.get('clientId') || `anon-${Math.random().toString(36).slice(2, 10)}`
  const gameParam = searchParams.get('game') || 'laststand'

  if (!room || !/^[A-Za-z0-9_-]{3,32}$/.test(room)) {
    return NextResponse.json({ error: 'Invalid room code' }, { status: 400 })
  }

  // Small allowlist rather than letting the client name arbitrary channel
  // namespaces -- one entry per co-op mini-game that uses this room system.
  const game = (['laststand', 'destroy'] as const).includes(gameParam as 'laststand' | 'destroy')
    ? gameParam
    : 'laststand'

  try {
    const client = new Ably.Rest(apiKey)
    const tokenRequest = await client.auth.createTokenRequest({
      clientId,
      capability: {
        [`${game}:${room}`]: ['publish', 'subscribe', 'presence']
      },
      ttl: 60 * 60 * 1000
    })
    return NextResponse.json(tokenRequest)
  } catch (error) {
    console.error('Ably token request error:', error)
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 })
  }
}
