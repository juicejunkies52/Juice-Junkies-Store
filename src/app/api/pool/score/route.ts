import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Guests can play and keep a local best (jj-pool-best in localStorage)
// but only logged-in accounts get a leaderboard entry, same gating as
// every other persistent score in this project.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const sunk = Number(body?.sunk)
  if (!Number.isFinite(sunk) || sunk < 0) {
    return NextResponse.json({ error: 'Invalid sunk' }, { status: 400 })
  }

  const existing = await prisma.poolScore.findUnique({ where: { userId: user.id } })
  const displayName = user.name || user.email.split('@')[0]

  if (!existing) {
    if (sunk > 0) {
      await prisma.poolScore.create({ data: { userId: user.id, name: displayName, sunk } })
    }
  } else if (sunk > existing.sunk) {
    await prisma.poolScore.update({
      where: { userId: user.id },
      data: { sunk, name: displayName }
    })
  }

  return NextResponse.json({ personalBest: Math.max(sunk, existing?.sunk || 0) })
}
