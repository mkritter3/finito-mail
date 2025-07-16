import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow auth routes
  if (pathname.startsWith('/auth') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Check for authentication on protected routes
  if (pathname.startsWith('/mail')) {
    // Since we use Web Worker token storage (not cookies), we'll handle auth client-side
    // The mail layout will check authentication and redirect if needed
    // For now, allow access to /mail routes - client-side auth check will handle redirects
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/mail/:path*', '/auth/:path*', '/api/auth/:path*']
}