import jwt from 'jsonwebtoken'

// Same JWT_SECRET/library the rest of the app already uses for auth
// (lib/userAuth.ts) -- these are distinct, narrow-purpose tokens though
// (not a login session): each only ever proves "the holder was emailed
// this specific order's link for this specific action," nothing more.
// Long expiry since the customer might not click it the day it arrives.
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development'

type PreOrderTokenPurpose = 'preorder_balance' | 'preorder_cancel'

interface PreOrderTokenPayload {
  orderId: string
  purpose: PreOrderTokenPurpose
}

function signPreOrderToken(orderId: string, purpose: PreOrderTokenPurpose): string {
  const payload: PreOrderTokenPayload = { orderId, purpose }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '180d' })
}

function verifyPreOrderToken(token: string, orderId: string, purpose: PreOrderTokenPurpose): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as PreOrderTokenPayload
    return payload.purpose === purpose && payload.orderId === orderId
  } catch {
    return false
  }
}

export function signPreOrderBalanceToken(orderId: string): string {
  return signPreOrderToken(orderId, 'preorder_balance')
}

export function verifyPreOrderBalanceToken(token: string, orderId: string): boolean {
  return verifyPreOrderToken(token, orderId, 'preorder_balance')
}

// Lets a customer cancel and refund their own reservation from an email
// link (the overdue notice -- see lib/preorderOverdue.ts) without needing
// to log in or email support, which is the actual point: the FTC's
// advance-payment rule expects a real way out when a promised ship date
// is missed, not just an apology.
export function signPreOrderCancelToken(orderId: string): string {
  return signPreOrderToken(orderId, 'preorder_cancel')
}

export function verifyPreOrderCancelToken(token: string, orderId: string): boolean {
  return verifyPreOrderToken(token, orderId, 'preorder_cancel')
}
