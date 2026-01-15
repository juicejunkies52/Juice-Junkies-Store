# 🏛️ SC Tax Registration Setup Guide

## ✅ Current Status: Ready for Tax Registration

Your Juice Junkies Shop is now fully configured for South Carolina sales tax compliance. Once you receive your SC tax registration number, follow these steps to activate tax collection.

## 📋 What We've Set Up

### 1. Tax Configuration Added ✅
- Environment variables for tax settings
- SC sales tax rate configuration (7% default)
- Tax registration number placeholder

### 2. Checkout System Updated ✅
- Automatic tax calculation based on shipping address
- Tax display in order summary
- Stripe payment intent includes tax metadata

### 3. Admin Tax Reporting ✅
- Tax report dashboard (`/admin/tax-reports`)
- CSV export functionality
- Compliance information and filing requirements

## 🎯 Next Steps (After SC Registration Approval)

### Step 1: Update Environment Variables
When you receive your SC tax registration number:

```bash
# Update .env file
SC_TAX_REGISTRATION_NUMBER="your-sc-registration-number"
SC_SALES_TAX_RATE="0.07"  # Adjust if needed (7% = 0.07)
STRIPE_TAX_ENABLED="true"
```

### Step 2: Configure Stripe Tax (Optional)
For automatic tax calculation via Stripe Tax:

1. Enable Stripe Tax in your Stripe Dashboard
2. Add your SC tax registration number
3. Configure tax rates for South Carolina
4. Update your checkout API to use Stripe's automatic tax calculation

### Step 3: Test Tax Calculation
1. Add items to cart
2. Use SC shipping address in checkout
3. Verify tax is calculated and displayed
4. Complete test purchase and check Stripe dashboard

### Step 4: Enable Production Mode
```bash
# Update .env with production Stripe keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## 🧪 Testing Tax Functionality

### Test Scenarios:
1. **SC Address**: Should calculate 7% sales tax
2. **Out-of-State**: Should show $0.00 tax
3. **Order Summary**: Tax should appear in breakdown
4. **Stripe Dashboard**: Tax amount should appear in metadata

### Test Addresses:
```
SC Address (Taxable):
123 Main Street
Charleston, SC 29401

Out-of-State (Tax-Exempt):
456 Oak Avenue
Charlotte, NC 28201
```

## 📊 Tax Reporting Features

### Admin Dashboard Access:
- Navigate to `/admin/tax-reports`
- View tax collected by period
- Export CSV reports for filing
- Monitor compliance requirements

### Report Periods Available:
- Current/Last Month
- Current/Last Quarter
- Current/Last Year
- Custom date ranges

### CSV Export Includes:
- Transaction date and ID
- Sale amounts (subtotal, shipping, tax)
- Customer shipping state
- Tax rate applied
- Payment status

## 📝 SC Filing Requirements

### Filing Frequency (Based on Annual Tax Liability):
- **Monthly**: If liability > $100 annually
- **Quarterly**: If liability $25-$100 annually
- **Annual**: If liability < $25 annually

### Filing Due Dates:
- **20th of the month** following the reporting period
- Example: January sales filed by February 20th

### Required Information:
- Gross sales amount
- Taxable sales amount
- Tax collected
- Exempt sales (out-of-state)
- Number of transactions

## 🛡️ Compliance Features Built-In

### Automatic Tax Collection ✅
- Only charges tax on SC addresses
- Accurate rate calculation
- Proper tax display to customers

### Record Keeping ✅
- All transactions stored with tax data
- Stripe metadata includes tax breakdown
- Exportable reports for audit trail

### Customer Transparency ✅
- Tax clearly shown in checkout
- Rate displayed (e.g., "Sales Tax (7.0% SC)")
- Tax calculation updates based on address

## 🚀 Go-Live Checklist

Before enabling tax collection:

- [ ] SC tax registration approved and number received
- [ ] Environment variables updated with registration number
- [ ] Test tax calculations with SC and out-of-state addresses
- [ ] Verify tax appears in Stripe dashboard
- [ ] Admin tax reports working correctly
- [ ] Production Stripe keys configured
- [ ] Customer service trained on tax policies

## 📞 Support & Compliance

### If You Need Help:
1. **Stripe Tax Questions**: Contact Stripe support
2. **SC Tax Law Questions**: Consult with tax professional
3. **Technical Issues**: Check logs in tax report API

### Important Notes:
- Keep all transaction records for audit purposes
- Monitor for SC tax rate changes
- File returns on time to avoid penalties
- Consider setting up automatic tax remittance

## 🎉 You're Ready!

Your Juice Junkies Shop now has:
✅ Full SC tax compliance system
✅ Automated tax calculation
✅ Professional reporting tools
✅ Audit-ready record keeping

Once you receive your SC tax registration, update the environment variables and you'll be collecting sales tax automatically! 🏛️💰