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

  if (order.fulfillmentStatus !== 'unfulfilled') {
    return { skipped: true, reason: 'Order is already fulfilled or in progress' }
  }

  const printfulItems = order.items.filter(item => item.product.fulfillmentType === 'printful')

  if (printfulItems.length === 0) {
    return { skipped: true, reason: 'No print-on-demand items in this order' }
  }

  const shippingAddress: OrderShippingAddress = JSON.parse(order.shippingAddress || '{}')

  if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.zipCode) {
    throw new Error(`Order ${orderId} is missing a complete shipping address`)
  }

  const printfulOrderData = {
    external_id: order.id,
    shipping: 'STANDARD',
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

  const printfulOrder = await printfulService.createOrder(printfulOrderData)

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: 'pending',
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
