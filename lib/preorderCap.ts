import { prisma } from './prisma'

export interface CapStatus {
  cap: number | null
  usedToday: number
  remaining: number | null
  capReached: boolean
  resetsAt: string
}

function startOfTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function nextMidnightUTC(): Date {
  const start = startOfTodayUTC()
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

// A single shared cap across every product, not per-product -- sized
// around what the email provider plan and the owner's own cash flow can
// absorb in one day. "Today" means one calendar day in UTC; the cap just
// resets at the next UTC midnight, no extra state needed to track when.
export async function getDailyPreOrderCapStatus(): Promise<CapStatus> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'singleton' } })
  const cap = settings?.dailyPreOrderCap ?? null
  const resetsAt = nextMidnightUTC().toISOString()

  if (cap === null) {
    return { cap: null, usedToday: 0, remaining: null, capReached: false, resetsAt }
  }

  const usedToday = await prisma.order.count({
    where: { isPreOrder: true, createdAt: { gte: startOfTodayUTC() } }
  })

  return {
    cap,
    usedToday,
    remaining: Math.max(0, cap - usedToday),
    capReached: usedToday >= cap,
    resetsAt
  }
}
