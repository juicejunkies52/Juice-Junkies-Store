import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (user) {
    const rows = await prisma.caughtCreature.findMany({
      where: { userId: user.id },
      select: { creatureType: true }
    })
    return NextResponse.json({ caught: rows.map((r) => r.creatureType) })
  }

  const visitorId = request.nextUrl.searchParams.get('visitorId')?.trim().slice(0, 64) || ''
  if (!visitorId) {
    return NextResponse.json({ caught: [] })
  }

  const rows = await prisma.caughtCreature.findMany({
    where: { visitorId },
    select: { creatureType: true }
  })

  return NextResponse.json({ caught: rows.map((r) => r.creatureType) })
}
