import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { z } from 'zod'

const testimonialSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  testimonial: z.string().min(1, 'Testimonial is required'),
  productPurchased: z.string().optional(),
  rating: z.number().min(1).max(5).default(5),
  isAnonymous: z.boolean().default(false),
  allowPublic: z.boolean().default(true)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = testimonialSchema.parse(body)

    // If not anonymous, name is required
    if (!data.isAnonymous && !data.name) {
      return NextResponse.json(
        { error: 'Name is required when not submitting anonymously' },
        { status: 400 }
      )
    }

    // Create testimonial
    const testimonial = await prisma.testimonial.create({
      data: {
        name: data.isAnonymous ? null : data.name,
        location: data.isAnonymous ? null : data.location,
        testimonial: data.testimonial,
        productPurchased: data.productPurchased,
        rating: data.rating,
        isAnonymous: data.isAnonymous,
        allowPublic: data.allowPublic
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Testimonial submitted successfully',
      id: testimonial.id
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Testimonial submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get approved testimonials for public display
    const testimonials = await prisma.testimonial.findMany({
      where: {
        isApproved: true,
        allowPublic: true
      },
      select: {
        id: true,
        name: true,
        location: true,
        testimonial: true,
        productPurchased: true,
        rating: true,
        isAnonymous: true,
        isFeatured: true,
        createdAt: true
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 50
    })

    const stats = await prisma.testimonial.aggregate({
      _count: { id: true },
      _avg: { rating: true },
      where: { isApproved: true }
    })

    return NextResponse.json({
      testimonials,
      stats: {
        total: stats._count.id,
        averageRating: stats._avg.rating || 5
      }
    })
  } catch (error) {
    console.error('Testimonials fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}