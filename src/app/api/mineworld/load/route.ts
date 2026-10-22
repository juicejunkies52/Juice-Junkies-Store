import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { getCurrentUser } from '../../../../../lib/userAuth'

// Signed-in lookup by userId first (follows the account across devices),
// falling back to visitorId (the common case: still the same browser that
// made the save, guest or not). Returns { world: null } rather than 404 --
// "no save yet" is a normal, expected response the client treats as "start
// a fresh world," not an error.
export async function GET(request: NextRequest) {
  const visitorId = (request.nextUrl.searchParams.get('visitorId') || '').trim().slice(0, 64)
  if (!visitorId) {
    return NextResponse.json({ error: 'Missing visitorId' }, { status: 400 })
  }

  const user = await getCurrentUser(request)
  let record = user ? await prisma.mineWorld.findUnique({ where: { userId: user.id } }) : null
  if (!record) {
    record = await prisma.mineWorld.findUnique({ where: { visitorId } })
  }

  if (!record) {
    return NextResponse.json({ world: null })
  }

  return NextResponse.json({
    world: {
      seed: record.seed,
      width: record.width,
      height: record.height,
      tileDiffs: record.tileDiffs,
      playerX: record.playerX,
      playerY: record.playerY,
      inventory: record.inventory,
      depthReached: record.depthReached
    }
  })
}
