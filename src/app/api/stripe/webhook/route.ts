import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '../../../../../lib/stripe'
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

async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing successful payment:', paymentIntent.id)

  // Extract order details from metadata
  const orderData = {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100, // Convert from cents
    currency: paymentIntent.currency,
    customerEmail: paymentIntent.receipt_email,
    status: 'paid',
    metadata: paymentIntent.metadata,
    shippingAddress: paymentIntent.shipping?.address,
    customerName: paymentIntent.shipping?.name,
    createdAt: new Date(paymentIntent.created * 1000)
  }

  // TODO: Save to database when Prisma is set up
  console.log('Order data:', orderData)

  // For now, just log the successful payment
  console.log('✅ Order processed successfully')
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
  // TODO: Implement email service (Resend, SendGrid, etc.)
  console.log('📧 Would send order confirmation email to:', paymentIntent.receipt_email)
}

async function fulfillOrder(paymentIntent: Stripe.PaymentIntent) {
  // Skip fulfillment in demo mode
  if (process.env.PRINTFUL_API_TOKEN === 'demo') {
    console.log('📦 Demo mode: Skipping Printful fulfillment')
    return
  }

  // TODO: Create Printful order when ready for production
  console.log('📦 Would create Printful order for:', paymentIntent.id)
}