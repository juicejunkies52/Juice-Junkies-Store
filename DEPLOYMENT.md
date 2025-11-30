# 🚀 Production Deployment Guide

## Prerequisites

### 1. Stripe Account Setup
- Create a [Stripe account](https://stripe.com)
- Get your production API keys:
  - `pk_live_...` (Publishable key)
  - `sk_live_...` (Secret key)
  - Setup webhooks for `whsec_...` (Webhook secret)

### 2. Printful Account (Optional)
- Create [Printful account](https://printful.com)
- Get API token and store ID
- Or set to "demo" for testing

### 3. Database Setup
- For production, use PostgreSQL or MySQL
- Update `DATABASE_URL` in environment variables

## Deployment Steps

### Option A: Deploy to Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables in Vercel Dashboard**
   ```bash
   # Database
   DATABASE_URL="your-production-database-url"

   # Authentication
   NEXTAUTH_SECRET="your-random-secret-32-chars"
   JWT_SECRET="your-jwt-secret-32-chars"
   NEXTAUTH_URL="https://your-domain.vercel.app"

   # Stripe Production
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
   STRIPE_SECRET_KEY="sk_live_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."

   # Printful
   PRINTFUL_API_TOKEN="your-printful-token"
   PRINTFUL_STORE_ID="your-store-id"

   # Site URL
   NEXT_PUBLIC_SITE_URL="https://your-domain.vercel.app"
   ```

5. **Setup Production Database**
   ```bash
   # After deployment, run:
   npx prisma migrate deploy
   npx prisma db push
   node scripts/setup-production.js
   ```

### Option B: Deploy to Netlify

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   - Connect your GitHub repo to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `.next`
   - Add environment variables in Netlify dashboard

## Post-Deployment Checklist

### ✅ Essential Checks
- [ ] Homepage loads correctly
- [ ] Products display properly
- [ ] Cart functionality works
- [ ] Checkout process completes
- [ ] Admin login works (`/admin/login`)
- [ ] Stripe payments process (test with small amount)
- [ ] Order emails sent (if configured)

### ✅ Security Checks
- [ ] Admin routes protected (try accessing without login)
- [ ] Environment variables secured
- [ ] HTTPS enabled
- [ ] API endpoints return proper errors

### ✅ Performance Checks
- [ ] Page load speed under 3 seconds
- [ ] Images optimized and loading
- [ ] Database queries efficient
- [ ] CDN configured (automatic with Vercel)

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Production database connection | `postgresql://...` |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | Random 32-char string |
| `JWT_SECRET` | JWT signing secret | Random 32-char string |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key | `pk_live_...` |
| `STRIPE_SECRET_KEY` | Stripe private key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` |
| `PRINTFUL_API_TOKEN` | Printful API access | Your token |
| `PRINTFUL_STORE_ID` | Printful store ID | Your store ID |
| `NEXT_PUBLIC_SITE_URL` | Your site URL | `https://your-domain.com` |

## Admin Access

Default admin credentials:
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change the default password after first login!

## Troubleshooting

### Common Issues

1. **Build Fails**
   - Check all environment variables are set
   - Ensure database is accessible
   - Verify all dependencies installed

2. **Database Errors**
   - Run `npx prisma migrate deploy`
   - Check `DATABASE_URL` is correct
   - Ensure database is running

3. **Stripe Errors**
   - Verify production API keys
   - Check webhook endpoints configured
   - Ensure HTTPS is enabled

4. **Admin Access Issues**
   - Run production setup script
   - Check JWT_SECRET is set
   - Verify admin user exists

## Support

For deployment issues:
1. Check Vercel/Netlify logs
2. Review environment variables
3. Test locally with production settings
4. Contact support if needed

## Next Steps After Deployment

1. **Domain Setup** - Configure custom domain
2. **Email Setup** - Configure transactional emails
3. **Analytics** - Add Google Analytics/tracking
4. **SEO** - Submit sitemap to search engines
5. **Monitoring** - Set up uptime monitoring
6. **Backups** - Configure database backups