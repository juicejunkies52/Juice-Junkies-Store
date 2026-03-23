import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '../../../../../lib/stripe'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'current-month'

    // Calculate date range (same logic as tax-report)
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (period) {
      case 'current-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'current-quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1)
        break
      case 'last-quarter':
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1
        startDate = new Date(now.getFullYear(), lastQuarter * 3, 1)
        endDate = new Date(now.getFullYear(), (lastQuarter + 1) * 3, 0)
        break
      case 'current-year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'last-year':
        startDate = new Date(now.getFullYear() - 1, 0, 1)
        endDate = new Date(now.getFullYear() - 1, 11, 31)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Demo mode - return mock CSV
    if (process.env.STRIPE_SECRET_KEY === 'demo' || !process.env.STRIPE_SECRET_KEY?.includes('sk_')) {
      const csvContent = `Date,Transaction ID,Amount,Subtotal,Shipping,Tax,Tax Rate,Customer State,Status
2024-01-15,pi_demo_001,45.99,36.00,9.99,0.00,0.00%,CA,succeeded
2024-01-16,pi_demo_002,78.52,65.98,9.99,2.55,7.0%,SC,succeeded
2024-01-17,pi_demo_003,125.00,125.00,0.00,8.75,7.0%,SC,succeeded
2024-01-18,pi_demo_004,89.99,89.99,0.00,0.00,0.00%,NY,succeeded
2024-01-19,pi_demo_005,156.47,139.98,9.99,6.50,7.0%,SC,succeeded`

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="tax-report-${period}-${now.toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Fetch payment intents from Stripe
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000),
      },
      expand: ['data.charges.data.billing_details']
    })

    // Generate CSV content
    let csvContent = 'Date,Transaction ID,Amount,Subtotal,Shipping,Tax,Tax Rate,Customer State,Status\n'

    paymentIntents.data.forEach((intent) => {
      const date = new Date(intent.created * 1000).toISOString().split('T')[0]
      const amount = (intent.amount / 100).toFixed(2)
      const subtotal = intent.metadata?.subtotal || '0.00'
      const shipping = intent.metadata?.shipping || '0.00'
      const tax = intent.metadata?.tax || '0.00'
      const taxRate = intent.metadata?.taxRate ?
        `${(parseFloat(intent.metadata.taxRate) * 100).toFixed(1)}%` : '0.0%'

      // Get customer state from shipping address or billing details
      let customerState = 'Unknown'
      if (intent.shipping?.address?.state) {
        customerState = intent.shipping.address.state
      } else if (intent.latest_charge && typeof intent.latest_charge === 'object' && 'billing_details' in intent.latest_charge) {
        customerState = intent.latest_charge.billing_details?.address?.state || 'Unknown'
      }

      csvContent += `${date},${intent.id},${amount},${subtotal},${shipping},${tax},${taxRate},${customerState},${intent.status}\n`
    })

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="tax-report-${period}-${now.toISOString().split('T')[0]}.csv"`
      }
    })

  } catch (error) {
    console.error('Tax export error:', error)
    return NextResponse.json(
      { error: 'Failed to export tax report' },
      { status: 500 }
    )
  }
}