import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

// Site-wide count of butterflies/999s flung in gravity mode. Single row,
// always "global" -- upsert so the first read/write creates it.

export async function GET() {
  try {
    const counter = await prisma.flingCounter.upsert({
      where: { id: 'global' },
      update: {},
      create: { id: 'global' }
    })

    return NextResponse.json({ count: counter.count })
  } catch (error) {
    console.error('Fling counter fetch error:', error)
    return NextResponse.json({ count: 0 })
  }
}

export async function POST() {
  try {
    const counter = await prisma.flingCounter.upsert({
      where: { id: 'global' },
      update: { count: { increment: 1 } },
      create: { id: 'global', count: 1 }
    })

    return NextResponse.json({ count: counter.count })
  } catch (error) {
    console.error('Fling counter increment error:', error)
    return NextResponse.json({ error: 'Failed to update counter' }, { status: 500 })
  }
}
