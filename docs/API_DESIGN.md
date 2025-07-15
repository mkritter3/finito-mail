# API Design - Client-First Architecture

## Overview

This document defines the minimal API surface for our client-first email client. Since 99% of operations happen directly between the browser and email providers, our API only handles authentication coordination and webhook reception.

## API Principles

1. **Minimal Surface**: Only auth and webhooks (no email data)
2. **Stateless**: No user data stored server-side
3. **PKCE-First**: Secure client-side authentication
4. **Event-Driven**: Webhooks trigger client updates
5. **Cost-Optimized**: Designed for free tier operation

## Client-First Architecture

### Direct Provider Access
```
┌──────────────────────────────────────────────────────┐
│                  BROWSER                              │
├──────────────────────────────────────────────────────┤
│  Gmail API      ←──────────→   Gmail Servers         │
│  Outlook API    ←──────────→   Microsoft Graph       │
│                                                       │
│  NO MIDDLEWARE, NO PROXY, NO BACKEND!                │
└──────────────────────────────────────────────────────┘
```

## Minimal Backend API

### 1. Authentication Endpoints

```typescript
// /api/auth/pkce/initiate
POST /api/auth/pkce/initiate
Request:
{
  provider: "gmail" | "outlook",
  code_challenge: string,
  redirect_uri: string
}

Response:
{
  state: string,
  auth_url: string
}

// /api/auth/pkce/callback
POST /api/auth/pkce/callback
Request:
{
  code: string,
  state: string,
  code_verifier: string
}

Response:
{
  // Just validates the flow, tokens are exchanged client-side
  success: boolean
}
```

### 2. Webhook Endpoints

```typescript
// /api/webhooks/gmail
POST /api/webhooks/gmail
Headers:
  X-Goog-Channel-Token: string
  X-Goog-Resource-State: string

Body:
{
  message: {
    data: string, // base64 encoded
    messageId: string
  }
}

Response: 200 OK

// /api/webhooks/outlook
POST /api/webhooks/outlook
Headers:
  ClientState: string

Body:
{
  value: [{
    changeType: string,
    clientState: string,
    resource: string,
    resourceData: object
  }]
}

Response: 200 OK
```

### 3. Subscription Status Endpoint

```typescript
// /api/subscription/status
GET /api/subscription/status
Headers:
  Authorization: Bearer [user-token]

Response:
{
  status: "active" | "trial" | "expired",
  plan: "free_trial" | "premium",
  trialEndsAt?: string, // ISO date
  expiresAt?: string, // ISO date
  features: {
    maxAccounts: number,
    exportFormats: string[],
    prioritySupport: boolean
  }
}

// Implementation: Check Stripe/payment provider
// No user data stored, just subscription status
```

### 4. Rate Limit Check

```typescript
// /api/rate-limit
GET /api/rate-limit
Headers:
  X-User-Identifier: string

Response:
{
  remaining: number,
  reset: number, // timestamp
  limit: number
}
```

## Client-Side API Usage

### Direct Gmail API

```typescript
// All these calls happen directly from the browser!
class GmailClient {
  async listMessages(token: string) {
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return response.json();
  }

  async getMessage(token: string, id: string) {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return response.json();
  }

  async sendMessage(token: string, message: string) {
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: btoa(message)
        })
      }
    );
    return response.json();
  }
}
```

### Direct Outlook API

```typescript
class OutlookClient {
  async listMessages(token: string) {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/messages',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return response.json();
  }

  async getMessage(token: string, id: string) {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return response.json();
  }

  async sendMessage(token: string, message: object) {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      }
    );
    return response.json();
  }
}
```

## Push Notification System

### Service Worker Registration

```typescript
// Client-side push handling
class PushManager {
  async subscribeToPush() {
    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });
    
    // Send subscription to our minimal backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
  }
}
```

### Webhook to Push Flow

```
1. Email arrives at Gmail/Outlook
2. Provider sends webhook to our endpoint
3. Cloudflare Worker receives webhook
4. Worker sends push notification to subscribed clients
5. Client wakes up and syncs directly with provider
```

## Error Handling

### Client-Side Error Recovery

```typescript
class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public recoverable: boolean
  ) {
    super(message);
  }
}

// Automatic retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is recoverable
      if (error.status === 429) { // Rate limited
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}
```

## Performance Optimizations

### Batch Operations

```typescript
// Client-side batching for Gmail
class BatchClient {
  async batchGet(token: string, messageIds: string[]) {
    const boundary = 'batch_boundary';
    const body = messageIds.map((id, index) => 
      `--${boundary}\n` +
      `Content-Type: application/http\n` +
      `Content-ID: ${index}\n\n` +
      `GET /gmail/v1/users/me/messages/${id}\n`
    ).join('\n') + `\n--${boundary}--`;
    
    const response = await fetch(
      'https://gmail.googleapis.com/batch/gmail/v1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/mixed; boundary=${boundary}`
        },
        body
      }
    );
    
    return this.parseBatchResponse(await response.text());
  }
}
```

## Cost Analysis

### Traditional API Costs (per 1000 users)
- API Gateway: $3.50/million requests = ~$350/month
- Lambda/Functions: 100ms avg = ~$200/month  
- Database queries: ~$500/month
- Total: ~$1,050/month

### Client-First API Costs (per 1000 users)
- Auth endpoints: <1000 requests/month = $0
- Webhook endpoints: <10k requests/month = $0
- Push notifications: Cloudflare free tier = $0
- Total: $0/month

## Security Considerations

### CORS Configuration

```typescript
// Vercel.json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://yourdomain.com"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET,POST,OPTIONS"
        }
      ]
    }
  ]
}
```

### Rate Limiting

```typescript
// Minimal rate limiting in Upstash Redis
export async function rateLimit(identifier: string) {
  const key = `rate:${identifier}`;
  const requests = await redis.incr(key);
  
  if (requests === 1) {
    await redis.expire(key, 3600); // 1 hour window
  }
  
  if (requests > 1000) {
    throw new APIError(
      'RATE_LIMITED',
      'Too many requests',
      true
    );
  }
}
```

## Migration Guide

### From Traditional to Client-First

1. **Remove GraphQL/REST endpoints** - No longer needed
2. **Remove database queries** - Everything in IndexedDB
3. **Update auth flow** - Implement PKCE
4. **Setup webhooks** - Gmail Push, Outlook subscriptions
5. **Remove caching layers** - Browser is the cache

### Code Removal Checklist

- [ ] GraphQL resolvers ❌ DELETE
- [ ] Database models ❌ DELETE
- [ ] Redis caching ❌ DELETE
- [ ] Email sync workers ❌ DELETE
- [ ] API rate limiters ❌ DELETE (keep minimal)
- [ ] Session management ❌ DELETE

---

**Remember**: In client-first architecture, the API essentially disappears. The browser talks directly to Gmail/Outlook, and we just coordinate the handshake. This is how we achieve $0.035/user/month infrastructure costs!