import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCreature } from '../../../../../lib/creatures'
import { getCurrentUser } from '../../../../../lib/userAuth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim().slice(0, 64) : ''
  const creatureType = typeof body.creatureType === 'string' ? body.creatureType.trim() : ''

  if (!visitorId || !getCreature(creatureType)) {
    return NextResponse.json({ error: 'Invalid catch' }, { status: 400 })
  }

  // Signed-in catches are tracked by userId so they follow the account
  // across browsers/devices; visitorId is still stored either way as a
  // record of which browser actually caught it.
  const user = await getCurrentUser(request)

  if (user) {
    const existing = await prisma.caughtCreature.findUnique({
      where: { userId_creatureType: { userId: user.id, creatureType } }
    })
    if (existing) {
      return NextResponse.json({ isNew: false })
    }
    await prisma.caughtCreature.create({ data: { visitorId, userId: user.id, creatureType } })
    return NextResponse.json({ isNew: true })
  }

  const existing = await prisma.caughtCreature.findUnique({
    where: { visitorId_creatureType: { visitorId, creatureType } }
  })

  if (existing) {
    return NextResponse.json({ isNew: false })
  }

  await prisma.caughtCreature.create({ data: { visitorId, creatureType } })
  return NextResponse.json({ isNew: true })
}
