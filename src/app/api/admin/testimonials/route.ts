import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function GET() {
  try {
    const testimonials = await prisma.testimonial.findMany({
      orderBy: [
        { isApproved: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      testimonials: testimonials
    })

  } catch (error) {
    console.error('Testimonials fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch testimonials' },
      { status: 500 }
    )
  }
}