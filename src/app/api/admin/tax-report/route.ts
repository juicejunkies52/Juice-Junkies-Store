import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '../../../../../lib/stripe'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'current-month'

    // Calculate date range based on period
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

    // Demo mode - return mock data
    if (process.env.STRIPE_SECRET_KEY === 'demo' || !process.env.STRIPE_SECRET_KEY?.includes('sk_')) {
      const mockData = {
        period: period,
        totalSales: 2750.85,
        taxableAmount: 1950.60,
        taxCollected: 136.54,
        exemptSales: 800.25,
        transactionCount: 47,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }

      return NextResponse.json(mockData)
    }

    // Fetch payment intents from Stripe for the date range
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000),
      },
    })

    // Calculate tax metrics
    let totalSales = 0
    let taxableAmount = 0
    let taxCollected = 0
    let exemptSales = 0
    let transactionCount = 0

    paymentIntents.data.forEach((intent) => {
      if (intent.status === 'succeeded') {
        transactionCount++
        const amount = intent.amount / 100 // Convert from cents

        const tax = parseFloat(intent.metadata?.tax || '0')
        const subtotal = parseFloat(intent.metadata?.subtotal || '0')
        const shipping = parseFloat(intent.metadata?.shipping || '0')

        totalSales += amount

        if (tax > 0) {
          // Taxable sale (SC address)
          taxableAmount += subtotal + shipping
          taxCollected += tax
        } else {
          // Exempt sale (out-of-state)
          exemptSales += amount
        }
      }
    })

    const taxData = {
      period: period,
      totalSales: Math.round(totalSales * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      taxCollected: Math.round(taxCollected * 100) / 100,
      exemptSales: Math.round(exemptSales * 100) / 100,
      transactionCount,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    }

    return NextResponse.json(taxData)

  } catch (error) {
    console.error('Tax report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate tax report' },
      { status: 500 }
    )
  }
}