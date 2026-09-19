import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '../../../../../lib/stripe'
import { prisma } from '../../../../../lib/prisma'
import { fulfillPrintfulOrder } from '../../../../../lib/fulfillOrder'
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

async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
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
  // TODO: No email service is configured yet (no Resend/SendGrid API key).
  // Until one is set up, order confirmations are not actually sent.
  console.log('📧 Would send order confirmation email to:', paymentIntent.receipt_email)
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