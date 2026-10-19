import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Public -- top 10 personal bests by wave reached.
export async function GET() {
  const top = await prisma.lastStandScore.findMany({
    orderBy: { wave: 'desc' },
    take: 10
  })

  return NextResponse.json(top.map((s) => ({ name: s.name, wave: s.wave })))
}
