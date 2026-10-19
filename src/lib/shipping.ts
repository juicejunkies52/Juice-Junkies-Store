export type ShippingMethod = 'standard' | 'express'

export const SHIPPING_METHODS: Record<ShippingMethod, { label: string; eta: string; flatRate: number; freeThreshold: number | null }> = {
  standard: { label: 'Standard', eta: '5-7 business days', flatRate: 9.99, freeThreshold: 75 },
  // Matches the "+$15.99" express upcharge already advertised on the order
  // summary page -- stacked on top of standard rather than a free-standing
  // price, and never discounted by the free-shipping threshold.
  express: { label: 'Express', eta: '2-3 business days', flatRate: 25.98, freeThreshold: null }
}

export function calculateShipping(subtotal: number, method: ShippingMethod): number {
  const config = SHIPPING_METHODS[method] || SHIPPING_METHODS.standard
  if (config.freeThreshold !== null && subtotal >= config.freeThreshold) return 0
  return config.flatRate
}

export function isShippingMethod(value: unknown): value is ShippingMethod {
  return value === 'standard' || value === 'express'
}
