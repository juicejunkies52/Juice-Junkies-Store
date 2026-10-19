'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AuthedUser {
  id: string
  email: string
  name: string | null
}

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthedUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.push('/account/login')
          return
        }
        setUser(d.user)
      })
      .catch(() => router.push('/account/login'))
      .finally(() => setLoading(false))
  }, [router])

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">My Account</h1>
        <p className="text-gray-400 mb-8">{user.name ? `${user.name} · ` : ''}{user.email}</p>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full py-3 px-4 rounded-lg border border-gray-700 text-white hover:border-accent transition-colors text-center"
          >
            Back to the site
          </Link>
          <button
            onClick={handleSignOut}
            className="block w-full py-3 px-4 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-900/20 transition-colors text-center"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
