export interface TaxCalculation {
  subtotal: number
  taxAmount: number
  taxRate: number
  total: number
  taxableAmount: number
}

export interface Address {
  state: string
  zipCode?: string
  city?: string
}

export function calculateTax(
  subtotal: number,
  shipping: number,
  address?: Address
): TaxCalculation {
  const taxableAmount = subtotal + shipping
  let taxRate = 0
  let taxAmount = 0

  if (address?.state?.toUpperCase() === 'SC') {
    taxRate = parseFloat(process.env.SC_SALES_TAX_RATE || '0.07')
    taxAmount = taxableAmount * taxRate
  }

  return {
    subtotal,
    taxAmount: Math.round(taxAmount * 100) / 100,
    taxRate,
    total: subtotal + shipping + taxAmount,
    taxableAmount
  }
}

export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function isTaxableState(state: string): boolean {
  return state?.toUpperCase() === 'SC'
}

export async function createTaxCalculationForStripe(
  amount: number,
  currency: string = 'usd',
  address?: Address
) {
  const stripeEnabled = process.env.STRIPE_TAX_ENABLED === 'true'

  if (!stripeEnabled || !address || !isTaxableState(address.state)) {
    return null
  }

  return {
    calculation: 'automatic_tax' as const,
    customer_details: {
      address: {
        line1: '',
        city: address.city || '',
        state: address.state,
        postal_code: address.zipCode || '',
        country: 'US',
      },
      address_source: 'shipping' as const,
    },
  }
}