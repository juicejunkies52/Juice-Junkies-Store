import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import { fulfillPrintfulOrder } from '../lib/fulfillOrder'

// Regression coverage for the original bug: a successful Stripe payment
// created no Order record anywhere and triggered no fulfillment (the
// webhook handler was a console.log TODO stub). These tests exercise the
// real order-creation and fulfillment code against the local dev database,
// with Printful in demo mode so nothing hits a real external API.
//
// Requires: local Postgres dev DB (DATABASE_URL) and PRINTFUL_API_TOKEN=demo.

describe('order chain', () => {
  let manualProductId: string
  let printfulProductId: string
  const createdOrderIds: string[] = []

  beforeAll(async () => {
    if (process.env.PRINTFUL_API_TOKEN !== 'demo') {
      throw new Error('These tests must run with PRINTFUL_API_TOKEN=demo to avoid hitting the real Printful API')
    }

    const manual = await prisma.product.create({
      data: {
        name: '__test manual product',
        slug: `__test-manual-${Date.now()}`,
        price: 1,
        images: '[]',
        tags: '[]',
        fulfillmentType: 'manual'
      }
    })
    manualProductId = manual.id

    const printful = await prisma.product.create({
      data: {
        name: '__test printful product',
        slug: `__test-printful-${Date.now()}`,
        price: 25,
        images: '[]',
        tags: '[]',
        fulfillmentType: 'printful',
        printfulExtId: 'mock-hoodie-1'
      }
    })
    printfulProductId = printful.id
  })

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
    await prisma.product.deleteMany({
      where: { id: { in: [manualProductId, printfulProductId] } }
    })
    await prisma.$disconnect()
  })

  it('creating a pending order, then marking it paid, records real data', async () => {
    const order = await prisma.order.create({
      data: {
        totalAmount: 1,
        shippingAddress: JSON.stringify({}),
        billingAddress: JSON.stringify({}),
        status: 'pending',
        stripePaymentIntentId: 'pi_test_fake',
        items: {
          create: [{ productId: manualProductId, quantity: 1, price: 1 }]
        }
      }
    })
    createdOrderIds.push(order.id)

    expect(order.status).toBe('pending')

    const shippingAddress = {
      name: 'Test Buyer',
      address: '123 Test St',
      city: 'Columbia',
      state: 'SC',
      zipCode: '29201',
      country: 'US',
      email: 'test@example.com'
    }

    const paid = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'paid', shippingAddress: JSON.stringify(shippingAddress) }
    })

    expect(paid.status).toBe('paid')
    expect(JSON.parse(paid.shippingAddress)).toEqual(shippingAddress)
  })

  it('skips fulfillment for manually-fulfilled products', async () => {
    const order = await prisma.order.create({
      data: {
        totalAmount: 1,
        shippingAddress: JSON.stringify({
          name: 'Test Buyer', address: '123 Test St', city: 'Columbia',
          state: 'SC', zipCode: '29201', country: 'US', email: 'test@example.com'
        }),
        billingAddress: JSON.stringify({}),
        status: 'paid',
        items: { create: [{ productId: manualProductId, quantity: 1, price: 1 }] }
      }
    })
    createdOrderIds.push(order.id)

    const result = await fulfillPrintfulOrder(order.id)

    expect(result.skipped).toBe(true)
    if (result.skipped) {
      expect(result.reason).toMatch(/no print-on-demand items/i)
    }
  })

  it('submits print-on-demand items to Printful (demo mode)', async () => {
    const order = await prisma.order.create({
      data: {
        totalAmount: 25,
        shippingAddress: JSON.stringify({
          name: 'Test Buyer', address: '123 Test St', city: 'Columbia',
          state: 'SC', zipCode: '29201', country: 'US', email: 'test@example.com'
        }),
        billingAddress: JSON.stringify({}),
        status: 'paid',
        items: { create: [{ productId: printfulProductId, quantity: 1, price: 25 }] }
      }
    })
    createdOrderIds.push(order.id)

    const result = await fulfillPrintfulOrder(order.id)

    expect(result.skipped).toBe(false)
    if (!result.skipped) {
      expect(result.itemCount).toBe(1)
      expect(result.printfulOrder).toBeDefined()
    }

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(updated.fulfillmentStatus).not.toBe('unfulfilled')
  })

  it('refuses to fulfill an order with no shipping address', async () => {
    const order = await prisma.order.create({
      data: {
        totalAmount: 25,
        shippingAddress: JSON.stringify({}),
        billingAddress: JSON.stringify({}),
        status: 'paid',
        items: { create: [{ productId: printfulProductId, quantity: 1, price: 25 }] }
      }
    })
    createdOrderIds.push(order.id)

    await expect(fulfillPrintfulOrder(order.id)).rejects.toThrow(/shipping address/i)
  })
})
