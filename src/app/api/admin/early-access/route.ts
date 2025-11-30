import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function GET() {
  try {
    const signups = await prisma.earlyAccess.findMany({
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      signups: signups
    })

  } catch (error) {
    console.error('Early access fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch early access signups' },
      { status: 500 }
    )
  }
}