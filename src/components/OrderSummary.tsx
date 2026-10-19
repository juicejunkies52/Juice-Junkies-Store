'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useCart } from '@/contexts/CartContext'
import ProductImage from './ProductImage'
import { calculateTax, formatTaxRate } from '@/lib/tax'
import { SHIPPING_METHODS, calculateShipping, ShippingMethod } from '@/lib/shipping'

export default function OrderSummary({
  shippingMethod,
  onShippingMethodChange
}: {
  shippingMethod: ShippingMethod
  onShippingMethodChange: (method: ShippingMethod) => void
}) {
  const { state } = useCart()
  const [shippingAddress, setShippingAddress] = useState<any>(null)

  const subtotal = state.total
  const shipping = calculateShipping(subtotal, shippingMethod)

  // Calculate tax based on shipping address (if available)
  const taxCalculation = calculateTax(subtotal, shipping, shippingAddress)
  const total = taxCalculation.total

  // Listen for address changes from Stripe Elements
  useEffect(() => {
    const handleAddressChange = (event: any) => {
      if (event.detail?.address) {
        setShippingAddress(event.detail.address)
      }
    }

    window.addEventListener('stripe-address-change', handleAddressChange)
    return () => window.removeEventListener('stripe-address-change', handleAddressChange)
  }, [])

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-800 p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Order Summary</h2>

      {/* Items */}
      <div className="space-y-4 mb-6">
        {state.items.map((item, index) => (
          <motion.div
            key={item.id}
            className="flex gap-4 p-4 bg-gray-900/30 rounded-lg border border-gray-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <ProductImage
                src={item.image}
                alt={item.name}
                productName={item.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm truncate">
                {item.name}
              </h3>
              {item.variantSize && (
                <p className="text-gray-400 text-xs">Size: {item.variantSize}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-400 text-sm">
                  ${item.price.toFixed(2)} x {item.quantity}
                </span>
                <span className="text-accent font-semibold">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Totals */}
      <div className="space-y-3 border-t border-gray-700 pt-6">
        <div className="flex justify-between text-gray-300">
          <span>Subtotal ({state.itemCount} items)</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>

        <div className="space-y-2">
          <span className="text-gray-300 text-sm">Shipping method</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(SHIPPING_METHODS) as [ShippingMethod, typeof SHIPPING_METHODS[ShippingMethod]][]).map(
              ([key, config]) => {
                const price = calculateShipping(subtotal, key)
                const selected = shippingMethod === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onShippingMethodChange(key)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-accent bg-accent/10'
                        : 'border-gray-700 bg-gray-900/30 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm">{config.label}</span>
                      <span className={`text-sm font-semibold ${price === 0 ? 'text-green-400' : 'text-accent'}`}>
                        {price === 0 ? 'FREE' : `$${price.toFixed(2)}`}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">{config.eta}</p>
                  </button>
                )
              }
            )}
          </div>
        </div>

        {shipping === 0 && (
          <motion.div
            className="flex justify-between text-green-400 text-sm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span>🎉 Free shipping unlocked!</span>
          </motion.div>
        )}

        {/* Tax (only show if applicable) */}
        {taxCalculation.taxAmount > 0 && (
          <div className="flex justify-between text-gray-300">
            <span>
              Sales Tax ({formatTaxRate(taxCalculation.taxRate)} SC)
            </span>
            <span>${taxCalculation.taxAmount.toFixed(2)}</span>
          </div>
        )}

        {/* Tax Info for non-SC addresses */}
        {!shippingAddress && (
          <div className="text-gray-400 text-xs italic">
            Tax will be calculated based on shipping address
          </div>
        )}

        <div className="flex justify-between text-xl font-bold text-white border-t border-gray-700 pt-3">
          <span>Total</span>
          <span className="text-accent">${total.toFixed(2)}</span>
        </div>

        {/* 999 Club Benefits */}
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/20 to-green-400/20 rounded-lg border border-accent/30">
          <h4 className="text-accent font-semibold mb-2 flex items-center gap-2">
            <span className="bg-accent text-black px-2 py-1 rounded-full text-xs font-bold">999</span>
            Club Benefits
          </h4>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>✓ Lifetime warranty on all items</li>
            <li>✓ Early access to new drops</li>
            <li>✓ Exclusive member-only designs</li>
          </ul>
        </div>
      </div>
    </div>
  )
}