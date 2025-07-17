import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { createHash } from "crypto";
import { redis } from "./lib/redis";

// Rate limit configuration from environment variables
const RATE_LIMITS = {
  general: parseInt(process.env.RATELIMIT_GENERAL_LIMIT || "100"),
  auth: parseInt(process.env.RATELIMIT_AUTH_LIMIT || "10"),
  sync: parseInt(process.env.RATELIMIT_SYNC_LIMIT || "50"),
  health: parseInt(process.env.RATELIMIT_HEALTH_LIMIT || "20"),
} as const;

// Create rate limiters with configurable limits
const ratelimits = {
  general: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.general, "1 m"),
    analytics: true,
    prefix: "rl:general",
  }),
  
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.auth, "1 m"),
    analytics: true,
    prefix: "rl:auth",
  }),
  
  sync: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.sync, "1 m"),
    analytics: true,
    prefix: "rl:sync",
  }),
  
  health: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMITS.health, "1 m"),
    analytics: true,
    prefix: "rl:health",
  }),
};

function getRateLimiter(pathname: string) {
  if (pathname.startsWith("/api/auth")) {
    return ratelimits.auth;
  }
  if (pathname.startsWith("/api/emails/sync") || pathname.startsWith("/api/sync")) {
    return ratelimits.sync;
  }
  if (pathname.startsWith("/api/health")) {
    return ratelimits.health;
  }
  return ratelimits.general;
}

function getIdentifier(request: NextRequest): string {
  // Try to get user identifier from authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    if (token) {
      // Use SHA256 hash of the token for unique, non-reversible identifier
      const hash = createHash('sha256').update(token).digest('hex');
      return `user:${hash}`;
    }
  }
  
  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : 
             request.headers.get("x-real-ip") || 
             "unknown";
  
  return `ip:${ip}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");

  // Generate fresh nonce for each request (required for Next.js strict-dynamic CSP)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  
  // Content Security Policy with nonce and strict-dynamic
  const cspHeader = [
    "default-src 'self'",
    // Nonce + strict-dynamic enables Next.js scripts while blocking unsafe-eval
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com`,
    // Keep unsafe-inline for styles (lower risk, commonly required)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:", // Allow email images
    "connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com",
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Create base response
  let response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  // Attach nonce to request headers for Server Components to access
  response.headers.set('x-nonce', nonce);
  
  // Apply CSP to all responses
  response.headers.set('Content-Security-Policy', cspHeader);

  // Apply rate limiting to API routes in production
  if (isApiRoute && process.env.NODE_ENV === "production") {
    try {
      const identifier = getIdentifier(request);
      const ratelimit = getRateLimiter(pathname);
      const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

      // Attach rate limit headers to all API responses
      response.headers.set("X-RateLimit-Limit", limit.toString());
      response.headers.set("X-RateLimit-Remaining", remaining.toString());
      response.headers.set("X-RateLimit-Reset", reset.toString());

      if (!success) {
        // Create rate-limited response
        const retryAfter = Math.round((reset - Date.now()) / 1000);
        response = new NextResponse(
          JSON.stringify({
            error: "Rate limit exceeded",
            message: "Too many requests, please try again later",
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": retryAfter.toString(),
              // Re-apply CSP and rate limit headers to error response
              "Content-Security-Policy": cspHeader,
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        );
      }
    } catch (error) {
      // Fail-open: If rate limiting fails, log error but allow request through
      console.error("Rate limiting error:", error);
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};