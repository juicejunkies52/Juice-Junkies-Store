import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ hasPurchased: false })
  }

  const count = await prisma.order.count({ where: { userId: user.id } })
  return NextResponse.json({ hasPurchased: count > 0 })
}
