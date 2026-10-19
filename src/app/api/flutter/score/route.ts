import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Guests can play and keep a local best (see jj-flutter-best in localStorage)
// but only logged-in accounts can hold the global #1 spot, same gating as
// every other persistent feature this session.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const score = Number(body?.score)
  if (!Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }

  const existing = await prisma.flutterScore.findUnique({ where: { userId: user.id } })
  const displayName = user.name || user.email.split('@')[0]

  if (!existing) {
    if (score > 0) {
      await prisma.flutterScore.create({ data: { userId: user.id, name: displayName, score } })
    }
  } else if (score > existing.score) {
    await prisma.flutterScore.update({
      where: { userId: user.id },
      data: { score, name: displayName }
    })
  }

  const top = await prisma.flutterScore.findFirst({ orderBy: { score: 'desc' } })

  return NextResponse.json({
    personalBest: Math.max(score, existing?.score || 0),
    isTopScorer: top?.userId === user.id
  })
}
