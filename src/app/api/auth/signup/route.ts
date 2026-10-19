import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { signUserToken, USER_COOKIE_NAME, USER_COOKIE_MAX_AGE } from '../../../../../lib/userAuth'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1).max(60).optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = signupSchema.parse(body)
    const normalizedEmail = email.toLowerCase().trim()

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email: normalizedEmail, password: hashedPassword, name: name || null }
    })

    const token = signUserToken({ userId: user.id, email: user.email })
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name }
    })
    response.cookies.set(USER_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: USER_COOKIE_MAX_AGE
    })
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid input' }, { status: 400 })
    }
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Something went wrong, try again' }, { status: 500 })
  }
}
