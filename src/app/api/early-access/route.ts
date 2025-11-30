import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { z } from 'zod'

const earlyAccessSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  size: z.string().min(1, 'Size is required'),
  notifications: z.boolean().default(true)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = earlyAccessSchema.parse(body)

    // Check if email already exists
    const existingSignup = await prisma.earlyAccess.findFirst({
      where: { email: data.email }
    })

    if (existingSignup) {
      return NextResponse.json(
        { error: 'Email already registered for early access' },
        { status: 409 }
      )
    }

    // Check if we're at capacity (limit to first 100)
    const count = await prisma.earlyAccess.count()
    if (count >= 100) {
      return NextResponse.json(
        { error: 'Early access is full. You have been added to the waitlist.' },
        { status: 409 }
      )
    }

    // Create early access signup
    const signup = await prisma.earlyAccess.create({
      data
    })

    // Also add to newsletter if they want notifications
    if (data.notifications) {
      await prisma.newsletter.upsert({
        where: { email: data.email },
        create: {
          email: data.email,
          source: 'early-access'
        },
        update: {
          isActive: true,
          source: 'early-access'
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully registered for early access',
      position: count + 1
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Early access signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const stats = await prisma.earlyAccess.aggregate({
      _count: {
        id: true
      }
    })

    return NextResponse.json({
      totalSignups: stats._count.id,
      spotsRemaining: Math.max(0, 100 - stats._count.id)
    })
  } catch (error) {
    console.error('Early access stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}