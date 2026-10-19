import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

export async function GET(request: NextRequest) {
  const feature = request.nextUrl.searchParams.get('feature') || ''
  const user = await getCurrentUser(request)
  if (!user || !feature) {
    return NextResponse.json({ unlocked: false })
  }

  const unlock = await prisma.digitalUnlock.findUnique({
    where: { userId_feature: { userId: user.id, feature } }
  })

  return NextResponse.json({ unlocked: !!unlock })
}
