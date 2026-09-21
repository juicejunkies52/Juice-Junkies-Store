import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

export async function middleware(request: NextRequest) {
  // Only protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Skip login and first-time setup pages (setup is self-protected: it
    // requires the setup key and refuses to run once an admin exists)
    if (request.nextUrl.pathname === '/admin/login' || request.nextUrl.pathname === '/admin/setup') {
      return NextResponse.next()
    }

    const token = request.cookies.get('admin-token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      await jwtVerify(token, secret)
      return NextResponse.next()
    } catch (error) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}