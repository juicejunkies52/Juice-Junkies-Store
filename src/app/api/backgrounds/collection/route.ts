import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (user) {
    const rows = await prisma.unlockedBackground.findMany({
      where: { userId: user.id },
      select: { backgroundId: true }
    })
    return NextResponse.json({ unlocked: rows.map((r) => r.backgroundId) })
  }

  const visitorId = request.nextUrl.searchParams.get('visitorId')?.trim().slice(0, 64) || ''
  if (!visitorId) {
    return NextResponse.json({ unlocked: [] })
  }

  const rows = await prisma.unlockedBackground.findMany({
    where: { visitorId },
    select: { backgroundId: true }
  })

  return NextResponse.json({ unlocked: rows.map((r) => r.backgroundId) })
}
