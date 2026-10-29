import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Public -- top 10 personal bests by pins knocked down.
export async function GET() {
  const top = await prisma.bowlingScore.findMany({
    orderBy: { pins: 'desc' },
    take: 10
  })

  return NextResponse.json(top.map((s) => ({ name: s.name, pins: s.pins })))
}
