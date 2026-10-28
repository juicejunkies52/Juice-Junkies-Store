import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

// Single-row site config (see SiteSettings in schema.prisma). Protected by
// src/middleware.ts's global /api/admin/* gate.
export async function GET() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'singleton' } })
  return NextResponse.json({ dailyPreOrderCap: settings?.dailyPreOrderCap ?? null })
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    let dailyPreOrderCap: number | null = null
    if (body?.dailyPreOrderCap === null) {
      dailyPreOrderCap = null
    } else if (typeof body?.dailyPreOrderCap === 'number' && body.dailyPreOrderCap >= 0) {
      dailyPreOrderCap = Math.floor(body.dailyPreOrderCap)
    } else {
      return NextResponse.json({ error: 'dailyPreOrderCap must be a non-negative number or null' }, { status: 400 })
    }

    const settings = await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', dailyPreOrderCap },
      update: { dailyPreOrderCap }
    })

    return NextResponse.json({ dailyPreOrderCap: settings.dailyPreOrderCap })
  } catch (error) {
    console.error('Error updating site settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
