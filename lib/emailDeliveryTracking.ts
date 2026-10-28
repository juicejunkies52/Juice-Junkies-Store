import { prisma } from './prisma'

type SendResult = { sent: true } | { sent: false; reason: string }

// Every email-sending function in lib/email.ts already reports success/
// failure instead of throwing (so one bad send never crashes the flow it's
// part of) -- but until now a failure just went to a server log nobody
// watches. This persists it onto the order itself so it shows up as a
// visible warning in the admin orders list, where it's actually seen.
// Cleared the next time a send for that same order succeeds.
export async function trackEmailResult(orderId: string, result: SendResult): Promise<void> {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: result.sent
        ? { emailDeliveryFailed: false, emailDeliveryError: null }
        : { emailDeliveryFailed: true, emailDeliveryError: result.reason }
    })
  } catch (error) {
    // Never let a tracking write itself break the caller's actual flow.
    console.error(`Failed to record email delivery result for order ${orderId}:`, error)
  }
}
