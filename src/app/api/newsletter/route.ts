import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { z } from 'zod'

const newsletterSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, source } = newsletterSchema.parse(body)

    // Check if email already exists
    const existingSubscription = await prisma.newsletter.findUnique({
      where: { email }
    })

    if (existingSubscription) {
      if (existingSubscription.isActive) {
        return NextResponse.json(
          { error: 'Email already subscribed' },
          { status: 409 }
        )
      } else {
        // Reactivate subscription
        await prisma.newsletter.update({
          where: { email },
          data: { isActive: true, source }
        })
      }
    } else {
      // Create new subscription
      await prisma.newsletter.create({
        data: {
          email,
          source: source || 'club999'
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to newsletter'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Newsletter signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const stats = await prisma.newsletter.aggregate({
      _count: {
        id: true
      },
      where: {
        isActive: true
      }
    })

    return NextResponse.json({
      totalSubscribers: stats._count.id
    })
  } catch (error) {
    console.error('Newsletter stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}