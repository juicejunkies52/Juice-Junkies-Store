import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Called right after signup/login with whatever visitorId was in this
// browser's localStorage -- attaches any anonymous catches made before
// signing in to the now-authenticated account, so nothing gets lost.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const visitorId = typeof body?.visitorId === 'string' ? body.visitorId.trim().slice(0, 64) : ''
  if (!visitorId) {
    return NextResponse.json({ linked: 0 })
  }

  const anonymousCatches = await prisma.caughtCreature.findMany({
    where: { visitorId, userId: null }
  })

  let linked = 0
  for (const row of anonymousCatches) {
    const alreadyHasIt = await prisma.caughtCreature.findUnique({
      where: { userId_creatureType: { userId: user.id, creatureType: row.creatureType } }
    })
    if (alreadyHasIt) {
      // Already linked to this account via another browser/visitorId --
      // the anonymous duplicate can just go.
      await prisma.caughtCreature.delete({ where: { id: row.id } })
      continue
    }
    await prisma.caughtCreature.update({ where: { id: row.id }, data: { userId: user.id } })
    linked++
  }

  // Same migration for where each creature was left in the decoration area.
  const anonymousDecorations = await prisma.creatureDecoration.findMany({
    where: { visitorId, userId: null }
  })
  for (const row of anonymousDecorations) {
    const alreadyHasIt = await prisma.creatureDecoration.findUnique({
      where: { userId_creatureType: { userId: user.id, creatureType: row.creatureType } }
    })
    if (alreadyHasIt) {
      await prisma.creatureDecoration.delete({ where: { id: row.id } })
      continue
    }
    await prisma.creatureDecoration.update({ where: { id: row.id }, data: { userId: user.id } })
  }

  return NextResponse.json({ linked })
}
