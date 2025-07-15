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
    // In a real app, you'd validate the token server-side
    // For now, we'll just check if it exists in the request
    const hasAuth = request.cookies.has('gmail_access_token')
    
    if (!hasAuth) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/mail/:path*', '/auth/:path*', '/api/auth/:path*']
}