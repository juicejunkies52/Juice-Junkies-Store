import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function GET() {
  try {
    const fanArt = await prisma.fanArt.findMany({
      orderBy: [
        { isApproved: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      fanArt: fanArt
    })

  } catch (error) {
    console.error('Fan art fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fan art' },
      { status: 500 }
    )
  }
}
