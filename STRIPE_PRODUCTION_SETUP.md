# 🚀 Stripe Production Keys Setup

## 🔑 Getting Your Live Stripe Keys

### Step 1: Access Your Stripe Dashboard
1. **Go to**: [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Make sure** you're logged into your Juice Junkies Shop account
3. **Switch to Live Mode** (toggle in top-left corner)

### Step 2: Get Your API Keys
**Navigate to**: Developers → API keys

You'll need these 3 keys:

#### 🟢 Publishable Key (Safe for frontend)
- **Starts with**: `pk_live_...`
- **Used for**: Frontend payment forms
- **Copy this key**

#### 🔴 Secret Key (Keep private!)
- **Starts with**: `sk_live_...`
- **Used for**: Backend API calls
- **⚠️ NEVER share this key**
- **Copy this key**

#### 🎯 Webhook Secret (From previous step)
- **Starts with**: `whsec_...`
- **Used for**: Webhook verification
- **Get from**: Developers → Webhooks → Your endpoint

## 📝 Update Your Environment Variables

Replace your demo keys in `.env`:

```bash
# Replace these demo keys:
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_51Dummy1234567890TestKeyForDevelopment"
STRIPE_SECRET_KEY="sk_test_51Dummy1234567890TestKeyForDevelopment"
STRIPE_WEBHOOK_SECRET="whsec_dummy123TestWebhookSecret"

# With your real live keys:
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_YOUR_ACTUAL_KEY_HERE"
STRIPE_SECRET_KEY="sk_live_YOUR_ACTUAL_KEY_HERE"
STRIPE_WEBHOOK_SECRET="whsec_YOUR_ACTUAL_WEBHOOK_SECRET"
```

## ⚠️ Important Security Notes

### 🔒 Secret Key Security:
- **Never** commit secret keys to Git
- **Never** expose in frontend code
- **Never** share in screenshots/messages
- **Always** keep in environment variables

### 🛡️ Best Practices:
- Use different keys for development/production
- Rotate keys periodically
- Monitor key usage in Stripe dashboard
- Set up key alerts

## 🧪 Test Mode vs Live Mode

### Test Mode (Development):
- **Keys start with**: `pk_test_...` and `sk_test_...`
- **No real money**: All payments are simulated
- **Test cards**: Use 4242 4242 4242 4242
- **Safe to experiment**

### Live Mode (Production):
- **Keys start with**: `pk_live_...` and `sk_live_...`
- **Real money**: Actual payments processed
- **Real cards**: Customer payment methods
- **Be careful with changes**

## 🏦 Account Requirements for Live Keys

### Business Information Required:
- ✅ Business name and type
- ✅ Tax ID (EIN or SSN)
- ✅ Bank account for payouts
- ✅ Business address
- ✅ Owner identification

### Verification Documents:
- ✅ Government-issued ID
- ✅ Bank account verification
- ✅ Business registration (if applicable)
- ✅ Tax documents

## 🚀 Activation Checklist

### Before Going Live:
- [ ] Account fully verified
- [ ] Bank account connected
- [ ] Business information complete
- [ ] Identity verification done
- [ ] Tax information provided

### After Getting Keys:
- [ ] Update environment variables
- [ ] Test with small amount first
- [ ] Monitor dashboard for issues
- [ ] Set up payout schedule
- [ ] Configure payment methods

## 💳 Payment Methods Configuration

Once live keys are active, configure:

### Card Payments:
- **Visa/Mastercard**: Enabled by default
- **American Express**: Usually enabled
- **Discover**: Usually enabled

### Digital Wallets:
- **Apple Pay**: Enable in dashboard
- **Google Pay**: Enable in dashboard
- **Link**: Stripe's express checkout

### Bank Transfers:
- **ACH**: For US customers
- **SEPA**: For European customers (if needed)

## 📊 Monitoring Your Live Account

### Dashboard Monitoring:
- **Payments**: Track all transactions
- **Disputes**: Monitor chargebacks
- **Radar**: Fraud prevention
- **Logs**: API request history

### Alerts to Set Up:
- Failed payments above threshold
- Dispute notifications
- Payout failures
- High-risk payments

## 🆘 Common Issues

### Account Under Review:
- **Happens**: With new accounts or sudden volume changes
- **Solution**: Provide requested documents quickly
- **Timeline**: Usually resolved in 1-7 days

### Payout Delays:
- **Reason**: Additional verification needed
- **Solution**: Complete business verification
- **Note**: Normal for new accounts

### Payment Failures:
- **Check**: Webhook configuration
- **Verify**: API keys are correct
- **Test**: With small amounts first

## 🎯 Ready to Go Live?

### Pre-Launch Test:
1. **Small test payment** ($1.00)
2. **Check webhook delivery**
3. **Verify payout appears**
4. **Test refund process**

### Launch Day:
1. **Monitor dashboard closely**
2. **Check first few orders manually**
3. **Verify tax calculations**
4. **Watch for any errors**

## 📞 Support Resources

### If You Need Help:
- **Stripe Support**: [support.stripe.com](https://support.stripe.com)
- **Documentation**: [stripe.com/docs](https://stripe.com/docs)
- **Status Page**: [status.stripe.com](https://status.stripe.com)

Your production keys will unlock real payment processing! 🎉

**Next**: Once keys are updated, we'll test a small payment and configure payment methods.