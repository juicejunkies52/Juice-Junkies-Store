import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getBackground } from '../../../../../lib/backgrounds'
import { getCurrentUser } from '../../../../../lib/userAuth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim().slice(0, 64) : ''
  const backgroundId = typeof body.backgroundId === 'string' ? body.backgroundId.trim() : ''

  if (!visitorId || !getBackground(backgroundId)) {
    return NextResponse.json({ error: 'Invalid unlock' }, { status: 400 })
  }

  // Signed-in unlocks are tracked by userId so they follow the account
  // across browsers/devices; visitorId is still stored either way as a
  // record of which browser actually earned it.
  const user = await getCurrentUser(request)

  if (user) {
    const existing = await prisma.unlockedBackground.findUnique({
      where: { userId_backgroundId: { userId: user.id, backgroundId } }
    })
    if (existing) {
      return NextResponse.json({ isNew: false })
    }
    await prisma.unlockedBackground.create({ data: { visitorId, userId: user.id, backgroundId } })
    return NextResponse.json({ isNew: true })
  }

  const existing = await prisma.unlockedBackground.findUnique({
    where: { visitorId_backgroundId: { visitorId, backgroundId } }
  })

  if (existing) {
    return NextResponse.json({ isNew: false })
  }

  await prisma.unlockedBackground.create({ data: { visitorId, backgroundId } })
  return NextResponse.json({ isNew: true })
}
