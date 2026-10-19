import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Public -- every player sees the current #1's message in the background,
// not just the person who holds it. No message set yet (nobody's claimed
// the spot) just means nothing renders.
export async function GET() {
  const top = await prisma.flutterScore.findFirst({ orderBy: { score: 'desc' } })

  if (!top) {
    return NextResponse.json({ message: null })
  }

  return NextResponse.json({ name: top.name, score: top.score, message: top.message })
}
