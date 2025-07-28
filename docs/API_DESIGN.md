# API Design - Hybrid Architecture

## Overview

This document defines the API surface for Finito Mail's hybrid architecture. Following Inbox Zero's approach, we combine client-side performance with server-side coordination for features like cross-device sync, search proxying, and time-based operations.

## Architecture Principles

1. **Metadata on Server**: Email headers and sync state in PostgreSQL
2. **Bodies on Demand**: Email content fetched directly from providers
3. **Client Cache**: IndexedDB for performance and offline access
4. **Minimal Proxying**: Server only proxies when necessary (search, rate limits)
5. **Push Updates**: Real-time sync via webhooks and WebSockets

## API Architecture

```
┌──────────────────────────────────────────────────────┐
│                    CLIENTS                            │
├──────────────────────────────────────────────────────┤
│  Web App    │    Desktop    │    Mobile              │
│  IndexedDB  │    IndexedDB  │    SQLite              │
└──────┬──────┴───────┬───────┴────────┬───────────────┘
       │              │                 │
       └──────────────┴─────────────────┘
                      │
                 HTTPS/WSS
                      │
┌──────────────────────────────────────────────────────┐
│               BACKEND SERVICES                        │
├─────────────┬──────────────┬─────────────────────────┤
│   Vercel    │  PostgreSQL  │      Redis              │
│  API/Auth   │   Metadata   │  Snooze/Cache           │
└─────────────┴──────────────┴─────────────────────────┘
                      │
                 Provider APIs
                      │
┌──────────────────────────────────────────────────────┐
│          Gmail API    │    Outlook API                │
└──────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. Authentication

```typescript
// OAuth2 PKCE flow coordination
POST   /api/auth/login
POST   /api/auth/callback
POST   /api/auth/refresh
DELETE /api/auth/logout

// Token management
GET    /api/auth/session
```

### 2. Email Metadata Sync

```typescript
// Sync email metadata to PostgreSQL
POST   /api/sync/metadata
Request: {
  emails: [{
    id: string,
    threadId: string,
    subject: string,
    snippet: string,
    from: { email: string, name?: string },
    date: string,
    labels: string[],
    isRead: boolean,
    hasAttachment: boolean
  }],
  lastHistoryId?: string
}

// Get metadata for cross-device sync
GET    /api/sync/metadata?since={timestamp}
Response: {
  emails: EmailMetadata[],
  deletedIds: string[],
  lastSync: string
}
```

### 3. Search Proxy

```typescript
// Server proxies to Gmail API for complete search
POST   /api/search
Request: {
  query: string,
  pageToken?: string,
  provider: 'gmail' | 'outlook'
}

Response: {
  messages: [{
    id: string,
    threadId: string,
    snippet: string
  }],
  nextPageToken?: string,
  resultSizeEstimate: number
}
```

### 4. Snooze Management

```typescript
// Snooze an email
POST   /api/snooze
Request: {
  emailId: string,
  snoozeUntil: string // ISO date
}

// Get snoozed emails
GET    /api/snooze
Response: {
  snoozed: [{
    emailId: string,
    snoozeUntil: string,
    snoozedAt: string
  }]
}

// Wake an email manually
DELETE /api/snooze/{emailId}
```

### 5. Push Notifications

```typescript
// WebSocket connection for real-time updates
WS     /api/ws
Messages: {
  type: 'GMAIL_CHANGE' | 'SNOOZE_WAKE' | 'SYNC_UPDATE',
  data: any
}

// Server-Sent Events fallback
GET    /api/notifications/stream

// Web Push subscription
POST   /api/push/subscribe
Request: PushSubscription
```

### 6. Webhooks

```typescript
// Gmail push notifications
POST   /api/webhooks/gmail

// Outlook webhooks  
POST   /api/webhooks/outlook

// Snooze wake-up cron
POST   /api/webhooks/snooze-wakeup
```

### 7. Settings & Preferences

```typescript
// User preferences (stored server-side for sync)
GET    /api/settings
PUT    /api/settings
Request: {
  signature?: string,
  defaultFrom?: string,
  keyboardShortcuts?: object,
  theme?: 'light' | 'dark' | 'auto'
}
```

### 8. Usage & Billing

```typescript
// Check subscription status
GET    /api/subscription/status
Response: {
  plan: 'trial' | 'starter' | 'pro',
  status: 'active' | 'canceled' | 'past_due',
  currentPeriodEnd: string,
  usage: {
    emailsSynced: number,
    storageUsed: number,
    apiCalls: number
  }
}

// Stripe checkout session
POST   /api/subscription/checkout
Request: {
  plan: 'starter' | 'pro',
  interval: 'monthly' | 'yearly'
}
```

## Client-Provider Direct Access

While we have a backend, clients still access providers directly for:

### Email Bodies (On-Demand)
```typescript
// Client fetches body when user opens email
async function fetchEmailBody(emailId: string) {
  // Check cache first
  const cached = await db.email_bodies.get(emailId);
  if (cached) return cached;
  
  // Fetch from provider
  const response = await gmailClient.messages.get({
    userId: 'me',
    id: emailId,
    fields: 'payload'
  });
  
  // Cache for next time
  await db.email_bodies.put({
    id: emailId,
    payload: response.data.payload
  });
  
  return response.data.payload;
}
```

### Sending Emails
```typescript
// Direct send via provider
async function sendEmail(draft: Draft) {
  const message = createMimeMessage(draft);
  
  const response = await gmailClient.messages.send({
    userId: 'me',
    requestBody: {
      raw: base64url(message)
    }
  });
  
  // Notify backend of sent email
  await api.post('/api/sync/sent', {
    messageId: response.data.id,
    threadId: response.data.threadId
  });
}
```

### Batch Operations
```typescript
// Client-side batching for efficiency
async function batchFetchMetadata(messageIds: string[]) {
  const batch = gapi.client.newBatch();
  
  messageIds.forEach((id, index) => {
    batch.add(
      gmailClient.messages.get({
        userId: 'me',
        id,
        fields: 'id,threadId,labelIds,snippet,payload/headers'
      }),
      { id: index.toString() }
    );
  });
  
  const responses = await batch.execute();
  return Object.values(responses.result);
}
```

## Rate Limiting Strategy

### Client-Side Rate Limiting
```typescript
class GmailRateLimiter {
  private tokens = 250; // Per user per second
  private lastRefill = Date.now();
  
  async acquire(cost: number): Promise<void> {
    this.refillTokens();
    
    while (this.tokens < cost) {
      await sleep(100);
      this.refillTokens();
    }
    
    this.tokens -= cost;
  }
  
  private refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refill = Math.floor(elapsed / 1000 * 250);
    
    this.tokens = Math.min(250, this.tokens + refill);
    this.lastRefill = now;
  }
}
```

### Server-Side Protection
```typescript
// Upstash Redis rate limiting
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true
});

export async function rateLimitMiddleware(req: Request) {
  const identifier = req.headers.get('user-id') || 'anonymous';
  const { success } = await ratelimit.limit(identifier);
  
  if (!success) {
    throw new Response('Rate limited', { status: 429 });
  }
}
```

## Error Handling

### Unified Error Response
```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  retryable: boolean;
  retryAfter?: number;
}

// Example error responses
{
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    details: { limit: 100, window: 60 }
  },
  retryable: true,
  retryAfter: 45
}

{
  error: {
    code: 'SYNC_CONFLICT',
    message: 'Conflicting changes detected',
    details: { 
      localVersion: '123',
      serverVersion: '125'
    }
  },
  retryable: false
}
```

## WebSocket Protocol

### Connection Management
```typescript
// Client WebSocket connection
class RealtimeConnection {
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  
  async connect(userId: string) {
    const token = await getAuthToken();
    
    this.ws = new WebSocket(
      `wss://api.finito.email/ws?token=${token}`
    );
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.send({ type: 'SUBSCRIBE', userId });
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = () => {
      this.scheduleReconnect();
    };
  }
  
  private handleMessage(message: WSMessage) {
    switch (message.type) {
      case 'GMAIL_CHANGE':
        this.onGmailChange(message.data);
        break;
      case 'SNOOZE_WAKE':
        this.onSnoozeWake(message.data);
        break;
      case 'SETTINGS_UPDATE':
        this.onSettingsUpdate(message.data);
        break;
    }
  }
}
```

## Cost Analysis

### Infrastructure Costs (Per 1000 Users)

| Service | Usage | Cost |
|---------|-------|------|
| Vercel API | 2M requests/month | $20 |
| PostgreSQL | 50MB/user metadata | $50 |
| Redis | Snooze + cache | $10 |
| Cloudflare | Webhooks + Workers | $0 |
| **Total** | | **$80/month** |
| **Per User** | | **$0.08** |

### Comparison with Traditional Architecture

| Approach | Storage | Compute | CDN | Total/User |
|----------|---------|---------|-----|------------|
| Traditional | $4-6 | $2-3 | $1 | $7-10 |
| Hybrid (Ours) | $0.05 | $0.02 | $0.01 | **$0.08** |
| Savings | | | | **99.2%** |

## Security Considerations

### Token Storage
- Access tokens never stored server-side
- Encrypted in IndexedDB with Web Crypto API
- Refresh tokens in httpOnly cookies
- Token rotation on each refresh

### Data Privacy
- Email bodies never touch our servers
- Metadata encrypted at rest in PostgreSQL
- TLS 1.3 for all connections
- CORS restricted to app domains

### Rate Limiting
- Per-user limits to prevent abuse
- Exponential backoff on client
- Circuit breaker pattern
- DDoS protection via Cloudflare

## Migration Notes

When migrating from pure client-first to hybrid:

1. **Add PostgreSQL** for metadata storage
2. **Implement sync endpoints** for cross-device support
3. **Add search proxy** for complete results
4. **Set up Redis** for snooze features
5. **Keep direct provider access** for bodies and sending

The hybrid approach gives us the best of both worlds: instant performance from local caching with the consistency and features enabled by light server coordination.

---

**Cost Summary**: The hybrid architecture costs ~$0.08-0.30/user/month while enabling critical features like cross-device sync, complete search, and time-based operations. This is still 95%+ cheaper than traditional server-heavy architectures.

## Error Handling

All endpoints follow consistent error response format:

```typescript
interface ErrorResponse {
  error: {
    code: string;          // e.g., 'RATE_LIMIT_EXCEEDED'
    message: string;       // Human-readable message
    details?: any;         // Additional context
    retryAfter?: number;   // For rate limits
  };
  status: number;          // HTTP status code
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `PROVIDER_ERROR` | 502 | Gmail/Outlook API error |
| `CIRCUIT_OPEN` | 503 | Service temporarily unavailable |
| `INTERNAL_ERROR` | 500 | Server error |

## Resilience Patterns

### Circuit Breaker

Prevents cascading failures when provider APIs are down:

```typescript
// packages/core/src/resilience/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly options: {
      failureThreshold: number;  // e.g., 5 failures
      resetTimeout: number;      // e.g., 60000ms (1 minute)
      halfOpenRetries: number;   // e.g., 3 test requests
    }
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailTime;
      if (elapsed > this.options.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
    this.failures = 0;
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }
}

// Usage in API routes
const gmailCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenRetries: 3
});

export async function searchEmails(query: string) {
  return gmailCircuitBreaker.execute(async () => {
    return gmailClient.users.messages.list({
      userId: 'me',
      q: query
    });
  });
}
```

### Retry with Exponential Backoff

For transient failures:

```typescript
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2
  } = options;
  
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on non-retryable errors
      if (\!isRetryable(error)) {
        throw error;
      }
      
      if (i < maxRetries - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(factor, i),
          maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * delay;
        await sleep(delay + jitter);
      }
    }
  }
  
  throw lastError\!;
}

function isRetryable(error: any): boolean {
  // Retry on network errors and 5xx status codes
  return (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    (error.response?.status >= 500 && error.response?.status < 600)
  );
}
```
