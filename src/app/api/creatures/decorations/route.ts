import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCreature } from '../../../../../lib/creatures'
import { getCurrentUser } from '../../../../../lib/userAuth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (user) {
    const rows = await prisma.creatureDecoration.findMany({
      where: { userId: user.id },
      select: { creatureType: true, x: true, y: true }
    })
    return NextResponse.json({ decorations: rows })
  }

  const visitorId = request.nextUrl.searchParams.get('visitorId')?.trim().slice(0, 64) || ''
  if (!visitorId) {
    return NextResponse.json({ decorations: [] })
  }

  const rows = await prisma.creatureDecoration.findMany({
    where: { visitorId },
    select: { creatureType: true, x: true, y: true }
  })

  return NextResponse.json({ decorations: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim().slice(0, 64) : ''
  const creatureType = typeof body.creatureType === 'string' ? body.creatureType.trim() : ''
  const x = typeof body.x === 'number' && Number.isFinite(body.x) ? body.x : null
  const y = typeof body.y === 'number' && Number.isFinite(body.y) ? body.y : null

  if (!visitorId || !getCreature(creatureType) || x === null || y === null) {
    return NextResponse.json({ error: 'Invalid decoration' }, { status: 400 })
  }

  const user = await getCurrentUser(request)

  // Only placing a creature you've actually caught is allowed -- checked
  // against whichever identity (account or anonymous browser) owns it.
  const caught = await prisma.caughtCreature.findFirst({
    where: user ? { userId: user.id, creatureType } : { visitorId, creatureType }
  })
  if (!caught) {
    return NextResponse.json({ error: "You haven't caught that one yet" }, { status: 403 })
  }

  if (user) {
    await prisma.creatureDecoration.upsert({
      where: { userId_creatureType: { userId: user.id, creatureType } },
      update: { x, y, visitorId },
      create: { visitorId, userId: user.id, creatureType, x, y }
    })
  } else {
    await prisma.creatureDecoration.upsert({
      where: { visitorId_creatureType: { visitorId, creatureType } },
      update: { x, y },
      create: { visitorId, creatureType, x, y }
    })
  }

  return NextResponse.json({ success: true })
}
