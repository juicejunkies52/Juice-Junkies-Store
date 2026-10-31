import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Public -- top 10 personal bests by balls sunk.
export async function GET() {
  const top = await prisma.poolScore.findMany({
    orderBy: { sunk: 'desc' },
    take: 10
  })

  return NextResponse.json(top.map((s) => ({ name: s.name, sunk: s.sunk })))
}
