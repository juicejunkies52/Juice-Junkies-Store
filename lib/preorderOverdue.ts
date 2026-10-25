import { prisma } from './prisma'
import { sendPreOrderOverdueEmail } from './email'
import { signPreOrderCancelToken } from './preorderToken'

interface OverdueCheckResult {
  checked: number
  notified: number
  failed: number
  failures: { orderId: string; error: string }[]
}

// Finds every pre-order that's past its promised shipByDate, hasn't been
// paid off or cancelled, and hasn't already been told about this -- then
// emails each one a real self-serve cancel link. Sent once per order
// (overdueNoticeSentAt gets set), not re-sent on every run. Called both by
// the daily cron (src/app/api/cron/check-overdue-preorders) and an
// admin-triggered manual run for immediate use.
export async function checkAndNotifyOverduePreOrders(): Promise<OverdueCheckResult> {
  const overdueOrders = await prisma.order.findMany({
    where: {
      isPreOrder: true,
      status: { in: ['pending', 'deposit_paid'] },
      shipByDate: { lt: new Date() },
      overdueNoticeSentAt: null
    },
    include: { items: { include: { product: true } } }
  })

  const result: OverdueCheckResult = { checked: overdueOrders.length, notified: 0, failed: 0, failures: [] }

  for (const order of overdueOrders) {
    try {
      if (!order.customerEmail) {
        result.failed++
        result.failures.push({ orderId: order.id, error: 'No email on file' })
        continue
      }

      const token = signPreOrderCancelToken(order.id)
      const cancelUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://juicejunkies.shop'}/preorder/cancel/${order.id}?token=${token}`
      const firstItem = order.items[0]

      const emailResult = await sendPreOrderOverdueEmail({
        orderId: order.id,
        customerEmail: order.customerEmail,
        productName: firstItem?.product.name || 'your item',
        shipByDate: order.shipByDate!.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        cancelUrl
      })

      // Marked notified either way -- an email provider hiccup shouldn't
      // mean we silently retry-spam this customer once it's back up; a
      // failed send here is something the admin can see and act on
      // manually, not something to auto-repeat indefinitely.
      await prisma.order.update({ where: { id: order.id }, data: { overdueNoticeSentAt: new Date() } })

      if (emailResult.sent) {
        result.notified++
      } else {
        result.failed++
        result.failures.push({ orderId: order.id, error: emailResult.reason })
      }
    } catch (error) {
      result.failed++
      result.failures.push({ orderId: order.id, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  return result
}
