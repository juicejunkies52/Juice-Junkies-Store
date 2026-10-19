import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Lifetime destruction count backing the "Smash Juice Junkies" rank/XP
// system -- cumulative across sessions, so this always increments rather
// than tracking a personal best like the other mini-game scores.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }
  const existing = await prisma.destroyScore.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ totalDestroyed: existing?.totalDestroyed || 0 })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const destroyed = Number(body?.destroyed)
  if (!Number.isFinite(destroyed) || destroyed <= 0) {
    return NextResponse.json({ error: 'Invalid destroyed count' }, { status: 400 })
  }

  const displayName = user.name || user.email.split('@')[0]
  const existing = await prisma.destroyScore.findUnique({ where: { userId: user.id } })

  const updated = existing
    ? await prisma.destroyScore.update({
        where: { userId: user.id },
        data: { totalDestroyed: existing.totalDestroyed + destroyed, name: displayName }
      })
    : await prisma.destroyScore.create({
        data: { userId: user.id, name: displayName, totalDestroyed: destroyed }
      })

  return NextResponse.json({ totalDestroyed: updated.totalDestroyed })
}
