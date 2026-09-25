import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../src/middleware'

// Regression coverage for the auth bypass found in production: every
// /api/admin/* route was reachable with zero authentication because the
// middleware matcher only ever covered /admin/:path* (the page routes),
// never /api/admin/:path* (the API routes it was actually supposed to
// protect too). Confirmed live with curl before the fix.
function request(path: string, cookie?: string) {
  return new NextRequest(new URL(`https://example.com${path}`), {
    headers: cookie ? { cookie: `admin-token=${cookie}` } : {}
  })
}

describe('admin auth middleware', () => {
  it('blocks unauthenticated requests to admin API routes', async () => {
    const res = await middleware(request('/api/admin/orders'))
    expect(res.status).toBe(401)
  })

  it('blocks unauthenticated requests to admin pages by redirecting to login', async () => {
    const res = await middleware(request('/admin/dashboard'))
    expect(res.status).toBe(307) // NextResponse.redirect default
    expect(res.headers.get('location')).toContain('/admin/login')
  })

  it('rejects a garbage/forged admin-token cookie', async () => {
    const res = await middleware(request('/api/admin/orders', 'not-a-real-jwt'))
    expect(res.status).toBe(401)
  })

  it('leaves the login page reachable with no token', async () => {
    const res = await middleware(request('/admin/login'))
    expect(res.status).toBe(200)
  })

  it('leaves the setup page reachable with no token', async () => {
    const res = await middleware(request('/admin/setup'))
    expect(res.status).toBe(200)
  })

  it('leaves the setup API reachable with no token', async () => {
    const res = await middleware(request('/api/admin/setup'))
    expect(res.status).toBe(200)
  })

  it('leaves the login API reachable with no token', async () => {
    const res = await middleware(request('/api/admin/auth/login'))
    expect(res.status).toBe(200)
  })

  it('does not touch non-admin routes', async () => {
    const res = await middleware(request('/shop'))
    expect(res.status).toBe(200)
  })
})
