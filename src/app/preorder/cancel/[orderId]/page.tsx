'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import AnimatedBackground from '../../../../components/AnimatedBackground'

export default function PreOrderCancelPage() {
  const { orderId } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') || ''

  const [productName, setProductName] = useState('')
  const [depositAmount, setDepositAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notCancellable, setNotCancellable] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => {
    if (!orderId || !token) return
    ;(async () => {
      try {
        const res = await fetch(`/api/preorder/cancel?orderId=${orderId}&token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'This link is invalid or has expired.')
          return
        }
        if (data.status !== 'pending' && data.status !== 'deposit_paid') {
          setNotCancellable(true)
          setProductName(data.productName)
          return
        }
        setProductName(data.productName)
        setDepositAmount(data.depositAmount || 0)
      } catch {
        setError('Something went wrong loading your order. Please try again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId, token])

  const handleCancel = async () => {
    setCancelling(true)
    setError('')
    try {
      const res = await fetch('/api/preorder/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to cancel and refund.')
        return
      }
      setDone(data.refundedAmount)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <motion.div
          className="text-6xl font-bold text-accent"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          999
        </motion.div>
      </div>
    )
  }

  if (done !== null) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <div className="text-center px-6">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-accent" />
          <h1 className="mb-2 text-2xl text-white">Cancelled &amp; refunded</h1>
          <p className="mb-6 text-gray-400">
            Your ${done.toFixed(2)} deposit is on its way back to your original payment method -- typically 5-10
            business days depending on your bank.
          </p>
          <button onClick={() => router.push('/')} className="btn-primary">
            Back to the Store
          </button>
        </div>
      </div>
    )
  }

  if (notCancellable) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <div className="text-center px-6">
          <h1 className="mb-2 text-2xl text-white">This reservation can&apos;t be cancelled from here</h1>
          <p className="mb-6 text-gray-400">
            {productName} has already moved past the deposit stage. If you still need help, reach out and we&apos;ll sort
            it out.
          </p>
          <button onClick={() => router.push('/')} className="btn-primary">
            Back to the Store
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <div className="text-center px-6">
          <h1 className="mb-4 text-2xl text-white">{error}</h1>
          <button onClick={() => router.push('/')} className="btn-primary">
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AnimatedBackground />
      <div className="relative z-40 flex min-h-screen items-center justify-center px-6 py-8">
        <motion.div
          className="w-full max-w-md rounded-xl border border-gray-800 bg-black/40 p-8 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="mb-2 text-2xl font-bold text-white">Cancel your reservation?</h1>
          <p className="mb-6 text-sm text-gray-400">
            {productName} is taking longer than we originally promised, and we want to make it right. You can cancel
            here and get your deposit back in full -- no hard feelings, and no need to contact anyone.
          </p>

          <div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center justify-between text-sm text-white/80">
              <span>Deposit to refund</span>
              <span className="text-xl font-bold text-accent">${depositAmount.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 py-4 font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
          >
            <XCircle className="h-5 w-5" />
            {cancelling ? 'Processing...' : `Cancel & Refund $${depositAmount.toFixed(2)}`}
          </button>
          <button
            onClick={() => router.push('/')}
            className="mt-3 w-full rounded-lg border border-gray-700 py-3 text-sm text-gray-300 transition-colors hover:bg-white/5"
          >
            No thanks, I&apos;ll keep waiting
          </button>
        </motion.div>
      </div>
    </div>
  )
}
