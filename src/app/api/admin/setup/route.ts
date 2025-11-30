import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const setupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z.string().email('Invalid email address'),
  setupKey: z.string()
})

// This should be a secure setup key in production
const SETUP_KEY = process.env.ADMIN_SETUP_KEY || 'juice999setup'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, email, setupKey } = setupSchema.parse(body)

    // Verify setup key
    if (setupKey !== SETUP_KEY) {
      return NextResponse.json(
        { error: 'Invalid setup key' },
        { status: 401 }
      )
    }

    // Check if any admin already exists
    const existingAdmin = await prisma.admin.findFirst()
    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Admin user already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create admin user
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        email,
        role: 'super_admin'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Admin setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Check if setup is needed
export async function GET() {
  try {
    const adminCount = await prisma.admin.count()

    return NextResponse.json({
      setupRequired: adminCount === 0,
      adminCount
    })
  } catch (error) {
    console.error('Admin setup check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}