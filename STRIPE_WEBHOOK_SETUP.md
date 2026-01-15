# 🔗 Stripe Webhook Setup Guide

## ✅ Webhook Endpoint Created

I've created your webhook endpoint at: `/api/stripe/webhook`
**Full URL**: `https://juicejunkies.shop/api/stripe/webhook`

## 🎯 Configure in Stripe Dashboard

### Step 1: Add Webhook Endpoint

1. **Go to Stripe Dashboard** → [stripe.com/dashboard](https://dashboard.stripe.com)
2. **Navigate to**: Developers → Webhooks
3. **Click**: "Add endpoint"
4. **Enter URL**: `https://juicejunkies.shop/api/stripe/webhook`

### Step 2: Select Events to Monitor

**Critical Events** (check these boxes):
```
✅ payment_intent.succeeded
✅ payment_intent.payment_failed
✅ payment_intent.canceled
✅ charge.dispute.created
```

**Optional Events** (for advanced features):
```
⬜ customer.created
⬜ customer.updated
⬜ invoice.payment_succeeded
⬜ subscription.created
```

### Step 3: Get Your Webhook Secret

After creating the webhook:
1. **Click** on your new webhook endpoint
2. **Find**: "Signing secret" section
3. **Click**: "Reveal"
4. **Copy**: The webhook secret (starts with `whsec_`)

### Step 4: Update Environment Variables

Replace your current webhook secret in `.env`:
```bash
# Replace this line:
STRIPE_WEBHOOK_SECRET="whsec_dummy123TestWebhookSecret"

# With your real secret:
STRIPE_WEBHOOK_SECRET="whsec_your_real_webhook_secret_here"
```

## 🧪 Test Your Webhook

### Option 1: Stripe CLI (Recommended for Development)
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to your account
stripe login

# Test webhook locally
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Option 2: Use Stripe Dashboard Test Mode
1. Create a test payment in Dashboard
2. Check webhook logs for successful delivery
3. Verify events appear in your application logs

## 🔍 What Your Webhook Does

### When Payment Succeeds ✅
- Logs successful payment
- Extracts order details
- Prepares for order fulfillment
- Ready for email confirmations

### When Payment Fails ❌
- Logs failure reason
- Tracks failed attempts
- Ready for customer notification

### When Disputes Occur ⚠️
- Alerts about chargebacks
- Logs dispute details
- Prepares evidence collection

## 🚨 Security Features

### Built-in Protection:
- **Signature Verification**: Validates requests are from Stripe
- **Event Deduplication**: Handles duplicate webhooks safely
- **Error Handling**: Graceful failure recovery
- **Logging**: Full audit trail

## 🔧 Environment Variables Needed

Make sure you have:
```bash
STRIPE_SECRET_KEY="sk_live_..." # Your live secret key
STRIPE_WEBHOOK_SECRET="whsec_..." # From webhook setup above
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..." # Your live publishable key
```

## 📊 Monitoring Webhooks

### In Stripe Dashboard:
- **View**: Developers → Webhooks → [Your endpoint]
- **Check**: Delivery attempts and response codes
- **Debug**: Failed deliveries and retry attempts

### In Your Application:
- **Check**: Server logs for webhook events
- **Monitor**: Console output for payment processing
- **Watch**: For any error messages

## 🚀 Ready for Production

Once webhook is configured:
1. **Test Mode**: Verify with test payments
2. **Live Mode**: Switch to live keys when ready
3. **Monitor**: Watch first live transactions closely
4. **Scale**: Webhook handles high-volume automatically

## 🆘 Troubleshooting

### Common Issues:
- **404 Error**: Check webhook URL is exactly `https://juicejunkies.shop/api/stripe/webhook`
- **Signature Failed**: Verify webhook secret is correct
- **Timeout**: Webhook must respond within 20 seconds

### Debug Steps:
1. Check Stripe webhook logs
2. Check your server logs
3. Test with Stripe CLI
4. Verify environment variables

Your webhook endpoint is ready! Just need to configure it in your Stripe dashboard. 🎉