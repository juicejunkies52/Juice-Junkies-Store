import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Guests can play and keep a local best (jj-laststand-best-wave in
// localStorage) but only logged-in accounts get a leaderboard entry, same
// gating as every other persistent feature in this game.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const wave = Number(body?.wave)
  if (!Number.isFinite(wave) || wave < 0) {
    return NextResponse.json({ error: 'Invalid wave' }, { status: 400 })
  }

  const existing = await prisma.lastStandScore.findUnique({ where: { userId: user.id } })
  const displayName = user.name || user.email.split('@')[0]

  if (!existing) {
    if (wave > 0) {
      await prisma.lastStandScore.create({ data: { userId: user.id, name: displayName, wave } })
    }
  } else if (wave > existing.wave) {
    await prisma.lastStandScore.update({
      where: { userId: user.id },
      data: { wave, name: displayName }
    })
  }

  return NextResponse.json({ personalBest: Math.max(wave, existing?.wave || 0) })
}
