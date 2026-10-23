import jwt from 'jsonwebtoken'

// Same JWT_SECRET/library the rest of the app already uses for auth
// (lib/userAuth.ts) -- this is a distinct, narrow-purpose token though
// (not a login session): it only ever proves "the holder was emailed this
// specific order's balance-due link," nothing more. Long expiry since the
// customer might not click it the day it arrives.
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development'

interface PreOrderBalancePayload {
  orderId: string
  purpose: 'preorder_balance'
}

export function signPreOrderBalanceToken(orderId: string): string {
  const payload: PreOrderBalancePayload = { orderId, purpose: 'preorder_balance' }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '180d' })
}

export function verifyPreOrderBalanceToken(token: string, orderId: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as PreOrderBalancePayload
    return payload.purpose === 'preorder_balance' && payload.orderId === orderId
  } catch {
    return false
  }
}
