import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

// Paths that must stay reachable without an admin-token cookie: the login
// page/endpoint itself (or nothing could ever log in), and setup (which is
// self-protected -- requires the setup key and refuses once an admin exists).
const PUBLIC_ADMIN_PATHS = new Set([
  '/admin/login',
  '/admin/setup',
  '/api/admin/setup',
  '/api/admin/auth/login'
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdminApi = pathname.startsWith('/api/admin')
  const isAdminPage = pathname.startsWith('/admin')

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next()
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get('admin-token')?.value
  const denied = () =>
    isAdminApi
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/admin/login', request.url))

  if (!token) {
    return denied()
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch (error) {
    return denied()
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
}