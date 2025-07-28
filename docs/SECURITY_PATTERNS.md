# Security Patterns

This document outlines the security patterns and implementations for Finito Mail, ensuring enterprise-grade security while maintaining our client-first architecture.

## OAuth Token Management

### The Problem
OAuth access tokens expire after 1 hour. Without proper refresh handling, users would need to re-authenticate hourly, creating a terrible user experience.

### The Solution
Implement automatic token refresh with secure backend handling of refresh tokens. **CRITICAL: Refresh tokens MUST NEVER be stored client-side.**

#### Refresh Token Storage Strategy

```typescript
// apps/auth/src/token-storage.ts
import { db } from './database'; // PostgreSQL
import { encrypt, decrypt } from './encryption';

export class RefreshTokenStorage {
  /**
   * Store refresh token securely in backend database
   * NEVER send to client or store in browser
   */
  async storeRefreshToken(
    userId: string, 
    refreshToken: string,
    provider: 'gmail' | 'outlook'
  ) {
    const encrypted = await encrypt(refreshToken, process.env.ENCRYPTION_KEY!);
    
    await db.user_tokens.upsert({
      user_id: userId,
      provider,
      refresh_token_encrypted: encrypted.ciphertext,
      refresh_token_iv: encrypted.iv,
      updated_at: new Date()
    });
  }
  
  async getRefreshToken(userId: string, provider: string) {
    const record = await db.user_tokens.findOne({ 
      user_id: userId, 
      provider 
    });
    
    if (!record) return null;
    
    return decrypt(
      record.refresh_token_encrypted,
      record.refresh_token_iv,
      process.env.ENCRYPTION_KEY!
    );
  }
}
```

#### Backend Token Refresh Endpoint

```typescript
// apps/auth/api/auth/refresh/route.ts
export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    // Get refresh token from secure backend storage
    const refreshToken = await tokenStorage.getRefreshToken(
      session.userId,
      session.provider
    );
    
    if (!refreshToken) {
      return new Response('Session expired', { status: 401 });
    }
    
    // Use refresh token to get new access token
    const tokens = await oauth.refreshAccessToken(refreshToken);
    
    // Update stored refresh token if provider rotated it
    if (tokens.refresh_token !== refreshToken) {
      await tokenStorage.storeRefreshToken(
        session.userId,
        tokens.refresh_token,
        session.provider
      );
    }
    
    // Return ONLY the access token to client
    return new Response(JSON.stringify({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      // NEVER include refresh_token in response!
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Token refresh failed:', error);
    return new Response('Token refresh failed', { status: 500 });
  }
}
```

```typescript
// packages/provider-client/src/auth/token-manager.ts
export class SecureTokenManager {
  private refreshTimer?: NodeJS.Timeout;
  
  async initialize() {
    const tokens = await this.getStoredTokens();
    if (tokens) {
      // Schedule refresh 5 minutes before expiry
      this.scheduleTokenRefresh(tokens.expiresIn);
    }
  }
  
  private scheduleTokenRefresh(expiresIn: number) {
    const refreshIn = (expiresIn - 300) * 1000;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    this.refreshTimer = setTimeout(() => {
      this.refreshTokens().catch(error => {
        console.error('Token refresh failed:', error);
        this.notifyUser('Session expired, please log in again');
      });
    }, refreshIn);
  }
  
  private async refreshTokens(): Promise<TokenSet> {
    // Call backend endpoint - refresh token NEVER leaves server
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Include session cookie
      headers: {
        'X-CSRF-Token': await this.getCSRFToken()
      }
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const newTokens = await response.json();
    await this.securelyStoreTokens(newTokens);
    this.scheduleTokenRefresh(newTokens.expires_in);
    
    return newTokens;
  }
}
```

### Security Principles
1. **Refresh tokens never leave the server** - Stored encrypted in PostgreSQL
2. **Access tokens are short-lived** - 1 hour expiry
3. **Automatic refresh** - Seamless user experience
4. **CSRF protection** - All auth endpoints require CSRF tokens
5. **Secure storage** - Tokens encrypted with AES-256-GCM

## XSS Protection

### Content Security Policy
Strict CSP headers prevent XSS attacks by controlling resource loading:

```typescript
// apps/web/middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Strict Content Security Policy
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://gmail.googleapis.com https://graph.microsoft.com wss://api.finito.email",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // Additional security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}
```

### Email Content Sanitization
Email content is sanitized before rendering to prevent XSS:

```typescript
// packages/core/src/security/sanitizer.ts
import DOMPurify from 'isomorphic-dompurify';

export class EmailSanitizer {
  private readonly config = {
    ALLOWED_TAGS: [
      'p', 'br', 'span', 'div', 'a', 'img',
      'b', 'i', 'u', 'strong', 'em',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'td', 'th'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class',
      'style', 'target', 'rel'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick']
  };
  
  sanitize(html: string): string {
    // Remove dangerous elements and attributes
    const cleaned = DOMPurify.sanitize(html, this.config);
    
    // Additional safety: ensure external links open in new tab
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleaned, 'text/html');
    
    doc.querySelectorAll('a[href^="http"]').forEach(link => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
    
    return doc.body.innerHTML;
  }
}
```

## Rate Limiting

### API Rate Limiting
Prevent abuse and protect against quota exhaustion:

```typescript
// apps/auth/api/middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true
});

export async function rateLimitMiddleware(
  request: Request
): Promise<Response | null> {
  const userId = await getUserId(request);
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Create identifier with user ID and endpoint
  const identifier = `${userId}:${request.method}:${new URL(request.url).pathname}`;
  
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  if (!success) {
    // Log potential abuse
    await logRateLimitViolation(userId, request);
    
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        'Retry-After': Math.floor((reset - Date.now()) / 1000).toString()
      }
    });
  }
  
  return null; // Continue to handler
}
```

### Gmail API Quota Protection
Track and prevent exceeding Gmail's 250 units/user/second limit:

```typescript
// packages/core/src/quota/quota-tracker.ts
export class QuotaTracker {
  private readonly QUOTA_LIMIT = 250; // units per second per user
  private readonly WARNING_THRESHOLD = 0.8; // 80% of limit
  
  async trackOperation(userId: string, units: number): Promise<boolean> {
    const key = `quota:${userId}:${Math.floor(Date.now() / 1000)}`;
    
    // Atomic increment
    const current = await redis.incrby(key, units);
    
    // Set expiry on first increment
    if (current === units) {
      await redis.expire(key, 60);
    }
    
    // Alert when approaching limit
    if (current > this.QUOTA_LIMIT * this.WARNING_THRESHOLD) {
      await this.alertHighUsage(userId, current);
    }
    
    // Return whether operation is allowed
    return current <= this.QUOTA_LIMIT;
  }
  
  private async alertHighUsage(userId: string, current: number) {
    // Log to monitoring
    logger.warn('User approaching Gmail quota limit', {
      userId,
      currentUsage: current,
      limit: this.QUOTA_LIMIT,
      percentage: (current / this.QUOTA_LIMIT) * 100
    });
    
    // Optionally notify user
    await notificationService.send(userId, {
      type: 'QUOTA_WARNING',
      message: 'Syncing is being throttled to prevent service disruption'
    });
  }
}
```

## Encryption

### Token Storage
OAuth tokens are encrypted before storage:

```typescript
// packages/crypto/src/token-encryption.ts
import { webcrypto } from 'crypto';

export class TokenEncryption {
  private readonly algorithm = 'AES-256-GCM';
  
  async encryptToken(token: string, userId: string): Promise<EncryptedToken> {
    // Derive key from master key + user ID
    const key = await this.deriveKey(userId);
    
    // Generate IV
    const iv = webcrypto.getRandomValues(new Uint8Array(16));
    
    // Encrypt
    const encrypted = await webcrypto.subtle.encrypt(
      {
        name: this.algorithm,
        iv
      },
      key,
      new TextEncoder().encode(token)
    );
    
    return {
      encrypted: Buffer.from(encrypted).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      algorithm: this.algorithm
    };
  }
  
  async decryptToken(encrypted: EncryptedToken, userId: string): Promise<string> {
    const key = await this.deriveKey(userId);
    
    const decrypted = await webcrypto.subtle.decrypt(
      {
        name: encrypted.algorithm,
        iv: Buffer.from(encrypted.iv, 'base64')
      },
      key,
      Buffer.from(encrypted.encrypted, 'base64')
    );
    
    return new TextDecoder().decode(decrypted);
  }
  
  private async deriveKey(userId: string): Promise<CryptoKey> {
    const masterKey = await this.getMasterKey();
    const salt = new TextEncoder().encode(userId);
    
    const keyMaterial = await webcrypto.subtle.importKey(
      'raw',
      masterKey,
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return webcrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}
```

## CSRF Protection

All state-changing operations require CSRF tokens:

```typescript
// packages/core/src/security/csrf.ts
import { randomBytes } from 'crypto';

export class CSRFProtection {
  private readonly TOKEN_LENGTH = 32;
  
  generateToken(): string {
    return randomBytes(this.TOKEN_LENGTH).toString('hex');
  }
  
  async validateToken(
    request: Request,
    session: Session
  ): Promise<boolean> {
    const token = request.headers.get('X-CSRF-Token');
    
    if (!token || !session.csrfToken) {
      return false;
    }
    
    // Constant-time comparison
    return this.secureCompare(token, session.csrfToken);
  }
  
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}
```

## Secure Session Management

```typescript
// apps/auth/src/session.ts
import { SessionOptions } from 'iron-session';

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'finito-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  }
};

export interface SessionData {
  userId?: string;
  csrfToken?: string;
  createdAt?: number;
}
```

## Security Checklist

### Authentication
- [x] OAuth2 PKCE flow implementation
- [x] Automatic token refresh
- [x] Secure token storage (encrypted)
- [x] CSRF protection
- [x] Session management

### Data Protection
- [x] XSS prevention (CSP headers)
- [x] Email content sanitization
- [x] HTTPS only
- [x] Secure headers (HSTS, X-Frame-Options, etc.)

### API Security
- [x] Rate limiting
- [x] Quota management
- [x] Circuit breaker pattern
- [x] Request validation

### Monitoring
- [x] Security event logging
- [x] Rate limit violation tracking
- [x] Failed authentication attempts
- [x] Anomaly detection

## Implementation Timeline

1. **Week 1**: OAuth token refresh + XSS protection
2. **Week 2**: Rate limiting implementation
3. **Week 3**: Circuit breaker pattern
4. **Week 4**: Quota tracking
5. **Ongoing**: Security monitoring and updates