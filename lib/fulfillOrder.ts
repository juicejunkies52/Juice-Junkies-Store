import { prisma } from './prisma'
import { printfulService } from './printful'

export class OrderNotFoundError extends Error {}

interface OrderShippingAddress {
  name?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  email?: string
}

type FulfillResult =
  | { skipped: true; reason: string }
  | { skipped: false; printfulOrder: any; itemCount: number }

// Submits an order's print-on-demand items to Printful and confirms it for
// production. Shared by the automatic post-payment webhook and the admin
// "fulfill" button so both paths stay in sync.
export async function fulfillPrintfulOrder(orderId: string): Promise<FulfillResult> {
  // Stripe redelivers webhook events on a slow or missed response (by
  // design -- "at least once" delivery), which gets more likely the busier
  // this endpoint is. Claiming the order atomically here (check-and-set in
  // one DB statement) closes the gap a plain read-then-write would leave
  // open: two near-simultaneous deliveries for the same event could both
  // read "unfulfilled" before either had written anything back, and both
  // would submit the same order to Printful -- shipping two physical items
  // for one payment. Whichever call's updateMany actually changes a row
  // wins the claim; the other sees count 0 and backs off.
  const claim = await prisma.order.updateMany({
    where: { id: orderId, fulfillmentStatus: 'unfulfilled' },
    data: { fulfillmentStatus: 'pending', updatedAt: new Date() }
  })

  if (claim.count === 0) {
    const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })
    if (!exists) {
      throw new OrderNotFoundError(`Order ${orderId} not found`)
    }
    return { skipped: true, reason: 'Order is already fulfilled or in progress' }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true, variant: true }
      }
    }
  })

  if (!order) {
    throw new OrderNotFoundError(`Order ${orderId} not found`)
  }

  const printfulItems = order.items.filter(item => item.product.fulfillmentType === 'printful')

  if (printfulItems.length === 0) {
    // Nothing to actually submit -- release the claim so the order doesn't
    // sit stuck in "pending" with no printfulOrderId to show for it.
    await prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'unfulfilled' } })
    return { skipped: true, reason: 'No print-on-demand items in this order' }
  }

  const shippingAddress: OrderShippingAddress = JSON.parse(order.shippingAddress || '{}')

  if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.zipCode) {
    // Same reasoning -- release the claim so this is retryable once the
    // address is fixed, instead of being permanently stuck as "pending".
    await prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'unfulfilled' } })
    throw new Error(`Order ${orderId} is missing a complete shipping address`)
  }

  // Printful's generic method codes -- it resolves these to the actual
  // carrier/service per destination country on its own.
  const printfulShipping = order.shippingMethod === 'express' ? 'PRIORITY' : 'STANDARD'

  const printfulOrderData = {
    external_id: order.id,
    shipping: printfulShipping,
    recipient: {
      name: shippingAddress.name || '',
      address1: shippingAddress.address,
      city: shippingAddress.city,
      state_code: shippingAddress.state || '',
      country_code: shippingAddress.country || 'US',
      zip: shippingAddress.zipCode,
      email: shippingAddress.email
    },
    items: printfulItems.map(item => ({
      // Prefer the specific variant's own Printful external id (each
      // color/size combo has its own) -- falling back to the product-level
      // id only for products with no variants at all.
      external_variant_id: item.variant?.printfulExtId || item.product.printfulExtId || item.product.id,
      quantity: item.quantity,
      retail_price: item.price.toString()
    }))
  }

  let printfulOrder
  try {
    printfulOrder = await printfulService.createOrder(printfulOrderData)
  } catch (createError) {
    // Nothing was actually created on Printful's side -- release the claim
    // so this is retryable rather than permanently stuck as "pending".
    await prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: 'unfulfilled' } })
    throw createError
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      printfulOrderId: printfulOrder.id?.toString(),
      updatedAt: new Date()
    }
  })

  if (process.env.PRINTFUL_API_TOKEN !== 'demo') {
    try {
      await printfulService.confirmOrder(printfulOrder.id.toString())

      await prisma.order.update({
        where: { id: orderId },
        data: { fulfillmentStatus: 'fulfilled', updatedAt: new Date() }
      })
    } catch (confirmError) {
      console.error('Error confirming Printful order:', confirmError)
      // Order is created in Printful but not confirmed - can be retried later.
    }
  }

  return { skipped: false, printfulOrder, itemCount: printfulItems.length }
}
