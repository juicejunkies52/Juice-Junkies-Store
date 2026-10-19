import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { getCurrentUser } from '../../../../lib/userAuth'

async function requireUnlockedUser(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) return null
  const unlock = await prisma.digitalUnlock.findUnique({
    where: { userId_feature: { userId: user.id, feature: 'neon-sketch' } }
  })
  return unlock ? user : null
}

export async function GET(request: NextRequest) {
  const user = await requireUnlockedUser(request)
  if (!user) {
    return NextResponse.json({ imageData: null })
  }
  const sketch = await prisma.neonSketch.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ imageData: sketch?.imageData || null })
}

export async function POST(request: NextRequest) {
  const user = await requireUnlockedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Neon Sketch is not unlocked on this account' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const imageData = typeof body?.imageData === 'string' ? body.imageData : ''
  if (!imageData.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
  }
  // A few MB is already a very busy sketch at the canvas size this draws
  // on -- cap it so nobody can post something absurd into the database.
  if (imageData.length > 3_000_000) {
    return NextResponse.json({ error: 'Sketch is too large to save' }, { status: 413 })
  }

  await prisma.neonSketch.upsert({
    where: { userId: user.id },
    update: { imageData },
    create: { userId: user.id, imageData }
  })

  return NextResponse.json({ success: true })
}
