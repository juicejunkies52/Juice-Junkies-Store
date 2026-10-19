'use client'

import { useEffect, useState } from 'react'
import { User } from 'lucide-react'

interface AuthedUser {
  id: string
  email: string
  name: string | null
}

export default function AccountMenu() {
  const [user, setUser] = useState<AuthedUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  if (!user) {
    return (
      <a href="/account/login" className="text-white hover:text-accent transition-colors">
        Sign In
      </a>
    )
  }

  return (
    <a
      href="/account"
      className="flex items-center gap-1.5 text-white hover:text-accent transition-colors"
      title={user.email}
    >
      <User className="w-4 h-4" />
      {user.name || 'Account'}
    </a>
  )
}
