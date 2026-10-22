import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Guest-friendly like /api/creatures/catch -- visitorId always required and
// always stored; a signed-in account's save is additionally keyed by
// userId so it follows them across devices, same split pattern as
// creatures/backgrounds. One row per visitor (or per account once linked),
// upserted on every autosave tick from the client.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim().slice(0, 64) : ''
  const seed = Number(body.seed)
  const width = Number(body.width)
  const height = Number(body.height)
  const playerX = Number(body.playerX)
  const playerY = Number(body.playerY)
  const depthReached = Number(body.depthReached) || 0
  const tileDiffs = body.tileDiffs && typeof body.tileDiffs === 'object' ? body.tileDiffs : null
  const inventory = body.inventory && typeof body.inventory === 'object' ? body.inventory : null

  if (
    !visitorId ||
    !Number.isFinite(seed) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(playerX) ||
    !Number.isFinite(playerY) ||
    !tileDiffs ||
    !inventory
  ) {
    return NextResponse.json({ error: 'Invalid save payload' }, { status: 400 })
  }
  // Defensive cap -- a legitimate session digging through a 180x110 world
  // never approaches this; guards against a malformed/abusive payload
  // bloating the row.
  if (Object.keys(tileDiffs).length > 20000) {
    return NextResponse.json({ error: 'Save too large' }, { status: 400 })
  }

  const data = { seed, width, height, tileDiffs, playerX, playerY, inventory, depthReached }
  const user = await getCurrentUser(request)

  if (user) {
    await prisma.mineWorld.upsert({
      where: { userId: user.id },
      update: data,
      create: { ...data, visitorId, userId: user.id }
    })
  } else {
    await prisma.mineWorld.upsert({
      where: { visitorId },
      update: data,
      create: { ...data, visitorId }
    })
  }

  return NextResponse.json({ ok: true })
}
