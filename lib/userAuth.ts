import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development'
const COOKIE_NAME = 'user-token'

interface UserTokenPayload {
  userId: string
  email: string
}

export function signUserToken(payload: UserTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export const USER_COOKIE_NAME = COOKIE_NAME
export const USER_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

// Reads the user-token cookie off an incoming request and returns the
// logged-in user, or null if there isn't a valid one -- used by routes
// that behave differently for guests vs signed-in customers (catching
// creatures, checkout) without requiring login the way admin routes do.
export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserTokenPayload
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    return user
  } catch {
    return null
  }
}
