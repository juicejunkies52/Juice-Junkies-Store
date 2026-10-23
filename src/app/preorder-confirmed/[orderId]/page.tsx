'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import AnimatedBackground from '../../../components/AnimatedBackground'

export default function PreOrderConfirmedPage() {
  const { orderId } = useParams()
  const router = useRouter()
  const [summary, setSummary] = useState<{
    status: string
    productName: string
    depositAmount: number | null
    balanceDue: number | null
    shipEstimate: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) return
    fetch(`/api/preorder/${orderId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [orderId])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <AnimatedBackground />
      <div className="relative z-40 mx-auto max-w-lg px-6 text-center">
        {loading ? (
          <motion.div
            className="text-6xl font-bold text-accent"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            999
          </motion.div>
        ) : summary ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-accent" />
            <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">You're Reserved!</h1>
            <p className="mb-6 text-gray-300">
              {summary.productName} is locked in for the official launch collection drop.
            </p>
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 text-left">
              <div className="flex items-center justify-between text-sm text-white/80">
                <span>Deposit paid</span>
                <span className="font-bold text-accent">${summary.depositAmount?.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                <span>Remaining balance</span>
                <span>${summary.balanceDue?.toFixed(2)}</span>
              </div>
              {summary.shipEstimate && <p className="mt-3 text-xs text-white/40">Estimated: {summary.shipEstimate}</p>}
            </div>
            <p className="mt-6 text-sm text-gray-400">
              We'll email you a link to pay the remaining balance once it's ready to ship. Check your inbox for a reservation
              confirmation now.
            </p>
            <button onClick={() => router.push('/')} className="btn-primary mt-8">
              Back to the Store
            </button>
          </motion.div>
        ) : (
          <div>
            <h1 className="mb-4 text-2xl text-white">We couldn't find that reservation</h1>
            <button onClick={() => router.push('/')} className="btn-primary">
              Return Home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
