import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, formatAmountFromStripe } from '../../../../../lib/stripe'
import { prisma } from '../../../../../lib/prisma'
import { fulfillPrintfulOrder } from '../../../../../lib/fulfillOrder'
import { sendOrderConfirmationEmail, sendAdminOrderNotificationEmail, sendPreOrderReservedEmail } from '../../../../../lib/email'
import Stripe from 'stripe'

// This is your Stripe CLI webhook secret for testing your endpoint locally
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent
      console.log('💰 Payment succeeded:', paymentIntentSucceeded.id)

      try {
        const orderType = paymentIntentSucceeded.metadata?.orderType

        // Donations carry no orderId at all (nothing to fulfill, nothing
        // to ship) -- without this branch they'd fall through to
        // handleSuccessfulPayment below, which throws on a missing
        // orderId and makes Stripe retry a webhook that was never going
        // to succeed.
        if (paymentIntentSucceeded.metadata?.type === 'donation') {
          console.log('💚 Donation received:', paymentIntentSucceeded.id, formatAmountFromStripe(paymentIntentSucceeded.amount))
          break
        }

        // Pre-order deposit/balance payments are a different flow from a
        // normal merch order -- same webhook event, different handling --
        // so branch BEFORE any normal-order side effect (confirmation
        // email, Printful fulfillment) ever runs. A deposit must NEVER
        // trigger real fulfillment of the full item; a balance payment
        // explicitly runs the normal post-payment steps itself, exactly
        // once, reusing the same proven functions the default path below
        // uses (the order is, by that point, functionally a normal paid
        // order -- same fulfillment pipeline from here on).
        if (orderType === 'preorder_deposit') {
          await handlePreOrderDepositPaid(paymentIntentSucceeded)
          break
        }
        if (orderType === 'preorder_balance') {
          await handlePreOrderBalancePaid(paymentIntentSucceeded)
          await sendOrderConfirmation(paymentIntentSucceeded)
          await fulfillOrder(paymentIntentSucceeded)
          break
        }

        // Save order to database
        await handleSuccessfulPayment(paymentIntentSucceeded)

        // Send confirmation email (if email service is configured)
        await sendOrderConfirmation(paymentIntentSucceeded)

        // Fulfill order with Printful (if not demo mode)
        await fulfillOrder(paymentIntentSucceeded)

      } catch (error) {
        console.error('Error processing successful payment:', error)
        // Return a non-200 so Stripe retries the webhook instead of silently
        // treating a failed order write/fulfillment as handled.
        return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
      }
      break

    case 'payment_intent.payment_failed':
      const paymentIntentFailed = event.data.object as Stripe.PaymentIntent
      console.log('❌ Payment failed:', paymentIntentFailed.id)

      try {
        await handleFailedPayment(paymentIntentFailed)
      } catch (error) {
        console.error('Error processing failed payment:', error)
      }
      break

    case 'payment_intent.canceled':
      const paymentIntentCanceled = event.data.object as Stripe.PaymentIntent
      console.log('🚫 Payment canceled:', paymentIntentCanceled.id)
      break

    case 'charge.dispute.created':
      const dispute = event.data.object as Stripe.Dispute
      console.log('⚠️ Dispute created:', dispute.id)

      try {
        await handleDispute(dispute)
      } catch (error) {
        console.error('Error handling dispute:', error)
      }
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}

function extractShippingAddress(paymentIntent: Stripe.PaymentIntent) {
  const shipping = paymentIntent.shipping

  return {
    name: shipping?.name || '',
    address: shipping?.address?.line1 || '',
    city: shipping?.address?.city || '',
    state: shipping?.address?.state || '',
    zipCode: shipping?.address?.postal_code || '',
    country: shipping?.address?.country || 'US',
    email: paymentIntent.receipt_email || undefined
  }
}

// Marks the reservation paid and emails the customer that they're locked
// in -- deliberately does NOT touch fulfillmentStatus, printfulOrderId or
// call fulfillOrder. Nothing ships off a deposit; that only happens once
// handlePreOrderBalancePaid runs, later, for the remaining amount.
async function handlePreOrderDepositPaid(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId
  if (!orderId) {
    throw new Error(`preorder_deposit payment with no orderId in metadata: ${paymentIntent.id}`)
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'deposit_paid',
      stripePaymentIntentId: paymentIntent.id,
      // Persisted here specifically because the balance-due email has to
      // go out weeks later -- long after this PaymentIntent (and its own
      // receipt_email) is gone from anywhere else.
      customerEmail: paymentIntent.receipt_email || undefined
    },
    include: { items: { include: { product: true } } }
  })

  console.log('✅ Pre-order deposit paid, reserved:', orderId)

  const firstItem = order.items[0]
  const result = await sendPreOrderReservedEmail({
    orderId: order.id,
    customerEmail: paymentIntent.receipt_email || '',
    productName: firstItem?.product.name || 'your item',
    depositAmount: order.depositAmount || 0,
    balanceDue: order.balanceDue || 0,
    shipEstimate: firstItem?.product.preOrderShipEstimate || undefined,
    shipByDate: order.shipByDate
      ? order.shipByDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : undefined
  })
  if (result.sent) {
    console.log('📧 Pre-order reservation email sent to:', paymentIntent.receipt_email)
  } else {
    console.log('📧 Pre-order reservation email not sent:', result.reason)
  }

  const admin = await prisma.admin.findFirst({ select: { email: true } })
  if (admin?.email && firstItem) {
    // Reuses the existing admin notification template, labeled clearly so
    // it isn't mistaken for a full sale ready to ship.
    const adminResult = await sendAdminOrderNotificationEmail({
      adminEmail: admin.email,
      orderId: order.id,
      customerEmail: paymentIntent.receipt_email || '',
      items: [{ name: `[PRE-ORDER DEPOSIT] ${firstItem.product.name}`, quantity: firstItem.quantity, price: firstItem.price }],
      totalAmount: order.depositAmount || 0
    })
    if (adminResult.sent) {
      console.log('📧 Admin pre-order notification sent to:', admin.email)
    }
  }
}

// The remaining-balance payment -- from here the order is functionally a
// normal paid order (shipping address collected now, same as a normal
// checkout), so this intentionally stops short of sending the
// confirmation email or fulfilling: the caller does both explicitly,
// reusing the exact same functions the default (non-pre-order) path uses.
async function handlePreOrderBalancePaid(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId
  if (!orderId) {
    throw new Error(`preorder_balance payment with no orderId in metadata: ${paymentIntent.id}`)
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'paid',
      balancePaymentIntentId: paymentIntent.id,
      shippingAddress: JSON.stringify(extractShippingAddress(paymentIntent))
    }
  })

  console.log('✅ Pre-order balance paid, order complete:', orderId)
}

async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
  // Digital unlocks (e.g. Neon Sketch) are a completely separate payment
  // path from merch orders -- same webhook event, different metadata
  // shape, so branch here before assuming this is an order.
  if (paymentIntent.metadata?.type === 'digital_unlock') {
    await handleDigitalUnlock(paymentIntent)
    return
  }

  const orderId = paymentIntent.metadata?.orderId

  if (!orderId) {
    // Should not happen for orders created via /api/checkout, which always
    // stamps the order id into the PaymentIntent metadata.
    throw new Error(`payment_intent.succeeded with no orderId in metadata: ${paymentIntent.id}`)
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'paid',
      stripePaymentIntentId: paymentIntent.id,
      shippingAddress: JSON.stringify(extractShippingAddress(paymentIntent))
    }
  })

  console.log('✅ Order marked as paid:', orderId)
}

async function handleDigitalUnlock(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId
  const feature = paymentIntent.metadata?.feature

  if (!userId || !feature) {
    throw new Error(`digital_unlock payment with missing metadata: ${paymentIntent.id}`)
  }

  await prisma.digitalUnlock.upsert({
    where: { userId_feature: { userId, feature } },
    update: { stripePaymentIntentId: paymentIntent.id },
    create: { userId, feature, stripePaymentIntentId: paymentIntent.id }
  })

  console.log(`✅ Digital unlock granted: ${feature} for user ${userId}`)
}

async function handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing failed payment:', paymentIntent.id)

  // Log the failure reason
  const failureReason = paymentIntent.last_payment_error?.message || 'Unknown error'
  console.log('Failure reason:', failureReason)

  // TODO: Notify customer about failed payment
  // TODO: Log to analytics/monitoring system
}

async function handleDispute(dispute: Stripe.Dispute) {
  console.log('Processing dispute:', dispute.id)

  // TODO: Send alert to admin
  // TODO: Gather evidence for dispute response
  // TODO: Log to customer service system

  console.log('⚠️ Dispute requires attention:', {
    id: dispute.id,
    amount: dispute.amount / 100,
    reason: dispute.reason,
    status: dispute.status
  })
}

async function sendOrderConfirmation(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId
  if (!orderId) return

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } }
  })

  if (!order) return

  const result = await sendOrderConfirmationEmail({
    orderId: order.id,
    customerEmail: paymentIntent.receipt_email || '',
    customerName: paymentIntent.shipping?.name,
    items: order.items.map(item => ({
      name: item.product.name,
      quantity: item.quantity,
      price: item.price
    })),
    totalAmount: order.totalAmount
  })

  if (result.sent) {
    console.log('📧 Order confirmation sent to:', paymentIntent.receipt_email)
  } else {
    console.log('📧 Order confirmation not sent:', result.reason)
  }

  const admin = await prisma.admin.findFirst({ select: { email: true } })
  if (admin?.email) {
    const adminResult = await sendAdminOrderNotificationEmail({
      adminEmail: admin.email,
      orderId: order.id,
      customerEmail: paymentIntent.receipt_email || '',
      items: order.items.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.price
      })),
      totalAmount: order.totalAmount
    })

    if (adminResult.sent) {
      console.log('📧 Admin order notification sent to:', admin.email)
    } else {
      console.log('📧 Admin order notification not sent:', adminResult.reason)
    }
  }
}

async function fulfillOrder(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.orderId
  if (!orderId) return

  // Skip fulfillment in demo mode
  if (process.env.PRINTFUL_API_TOKEN === 'demo') {
    console.log('📦 Demo mode: Skipping Printful fulfillment')
    return
  }

  const result = await fulfillPrintfulOrder(orderId)

  if (result.skipped) {
    console.log(`📦 Fulfillment skipped for order ${orderId}: ${result.reason}`)
  } else {
    console.log(`📦 Printful order created for ${orderId}:`, result.printfulOrder?.id)
  }
}