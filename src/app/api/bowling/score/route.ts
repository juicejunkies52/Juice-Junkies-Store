import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Guests can play and keep a local best (jj-bowling-best in localStorage)
// but only logged-in accounts get a leaderboard entry, same gating as
// every other persistent score in this project.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const pins = Number(body?.pins)
  if (!Number.isFinite(pins) || pins < 0) {
    return NextResponse.json({ error: 'Invalid pins' }, { status: 400 })
  }

  const existing = await prisma.bowlingScore.findUnique({ where: { userId: user.id } })
  const displayName = user.name || user.email.split('@')[0]

  if (!existing) {
    if (pins > 0) {
      await prisma.bowlingScore.create({ data: { userId: user.id, name: displayName, pins } })
    }
  } else if (pins > existing.pins) {
    await prisma.bowlingScore.update({
      where: { userId: user.id },
      data: { pins, name: displayName }
    })
  }

  return NextResponse.json({ personalBest: Math.max(pins, existing?.pins || 0) })
}
