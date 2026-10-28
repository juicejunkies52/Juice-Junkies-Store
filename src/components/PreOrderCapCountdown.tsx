'use client'

import { useEffect, useState } from 'react'

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'resetting...'
  const totalMinutes = Math.ceil(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

// Small live-updating "resets in Xh Ym" label -- used wherever the shared
// daily pre-order cap has been hit, so a sold-out product reads as "come
// back later" rather than just gone.
export default function PreOrderCapCountdown({ resetsAt }: { resetsAt: string }) {
  const [label, setLabel] = useState(() => formatRemaining(new Date(resetsAt).getTime() - Date.now()))

  useEffect(() => {
    const id = setInterval(() => {
      setLabel(formatRemaining(new Date(resetsAt).getTime() - Date.now()))
    }, 30000)
    return () => clearInterval(id)
  }, [resetsAt])

  return <span>{label}</span>
}
