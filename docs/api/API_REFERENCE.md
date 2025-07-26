---
tool_id: api-reference
version: '1.0'
last_verified: '2025-01-17T10:30:00Z'
status: active
description: Complete API reference for Finito Mail production infrastructure
generation_timestamp: '2025-01-17T10:30:00.000Z'
---

# 📡 Finito Mail API Reference

**Production-Ready API with Enterprise Infrastructure**

> **✅ PRODUCTION STATUS:** Hardened security, resilience patterns, monitoring  
> **🔒 SECURITY:** Nonce-based CSP, rate limiting, input sanitization  
> **⚡ PERFORMANCE:** Circuit breakers, concurrency control, caching  

## 🚀 Base URLs

**Development:**
- API: `http://localhost:3001`
- Web: `http://localhost:3000`

**Production:**
- API: `https://api.yourdomain.com`
- Web: `https://yourdomain.com`

## 🔐 Authentication

### OAuth 2.0 PKCE Flow
```bash
# 1. Initiate OAuth flow
GET /api/auth/google
# Redirects to Google OAuth consent

# 2. Handle callback
GET /api/auth/google/callback?code=...&state=...
# Returns JWT token for subsequent requests

# 3. Use JWT token
Authorization: Bearer <jwt_token>
```

### JWT Token Structure
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "iat": 1642521600,
  "exp": 1642608000
}
```

## 📧 Email API

### Get User's Emails
```http
GET /api/emails
Authorization: Bearer <token>
```

**Query Parameters:**
- `query` (string): Gmail search query syntax
- `limit` (number): Max results (default: 20, max: 100)
- `pageToken` (string): Pagination token

**Response:**
```json
{
  "emails": [
    {
      "id": "gmail_message_id",
      "threadId": "gmail_thread_id",
      "subject": "Email subject",
      "from": "sender@example.com",
      "to": "recipient@example.com", 
      "date": "2025-01-17T10:30:00.000Z",
      "snippet": "Email preview text...",
      "isRead": false,
      "labels": ["INBOX", "IMPORTANT"]
    }
  ],
  "nextPageToken": "next_page_token",
  "total": 150
}
```

### Get Single Email Content
```http
GET /api/emails/{messageId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "gmail_message_id",
  "subject": "Email subject",
  "from": "Sender Name <sender@example.com>",
  "to": "recipient@example.com",
  "htmlBody": "<p>Sanitized HTML content</p>",
  "textBody": "Plain text content",
  "date": "2025-01-17T10:30:00.000Z",
  "cached": true,
  "cacheType": "intelligent",
  "fetchTime": 245,
  "contentSize": 15240
}
```

**Features:**
- ✅ **Server-side HTML sanitization** with DOMPurify
- ✅ **Intelligent caching** with TTL management
- ✅ **Metadata-first approach** for blazing-fast loading
- ✅ **Circuit breaker protection** for Gmail API

### Email Sync Operations
```http
POST /api/emails/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "strategy": "incremental|full",
  "maxEmails": 100,
  "labelIds": ["INBOX"]
}
```

**Response:**
```json
{
  "status": "completed",
  "emailsSynced": 25,
  "newEmails": 15,
  "updatedEmails": 10,
  "duration": 2340,
  "nextSyncToken": "sync_token_123"
}
```

### Bulk Email Actions
```http
POST /api/emails/bulk-action
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "archive|delete|mark_read|mark_unread",
  "messageIds": ["msg1", "msg2", "msg3"]
}
```

## 🔧 Rules & Automation

### Get User Rules
```http
GET /api/rules
Authorization: Bearer <token>
```

**Response:**
```json
{
  "rules": [
    {
      "id": "rule_123",
      "name": "Archive Newsletters",
      "conditions": [
        {
          "field": "from",
          "operator": "contains",
          "value": "newsletter"
        }
      ],
      "actions": [
        {
          "type": "archive"
        }
      ],
      "enabled": true,
      "stats": {
        "totalExecutions": 156,
        "lastExecuted": "2025-01-17T09:15:00.000Z"
      }
    }
  ]
}
```

### Create/Update Rule
```http
POST /api/rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Rule name",
  "conditions": [...],
  "actions": [...],
  "enabled": true
}
```

### Test Rule
```http
POST /api/rules/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "conditions": [...],
  "sampleSize": 10
}
```

## 🧠 Onboarding & AI

### Get Onboarding Suggestions
```http
GET /api/onboarding/suggestions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": "suggestion_1",
      "type": "triage_rule",
      "title": "Archive marketing emails",
      "description": "Based on your email patterns...",
      "confidence": 0.85,
      "estimatedImpact": "Will organize 45% of your emails",
      "rule": {
        "conditions": [...],
        "actions": [...]
      }
    }
  ],
  "totalSuggestions": 8,
  "completionScore": 0.3
}
```

### Accept/Reject Suggestion
```http
POST /api/onboarding/suggestions/{id}/accept
POST /api/onboarding/suggestions/{id}/reject
Authorization: Bearer <token>
```

### Cleanup Suggestions
```http
POST /api/onboarding/cleanup
Authorization: Bearer <token>
```

## 🩺 Health & Monitoring

### Health Check
```http
GET /api/health
x-health-api-key: your-health-api-key
```

**Response (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T10:30:00.000Z",
  "checks": [
    {
      "service": "database",
      "status": "healthy",
      "latency": 45
    },
    {
      "service": "redis",
      "status": "healthy", 
      "latency": 12
    },
    {
      "service": "email_sync",
      "status": "healthy"
    }
  ],
  "uptime": 86400,
  "version": "1.0.0"
}
```

**Status Codes:**
- `200` - Healthy (all services operational)
- `200` - Degraded (functional but attention needed)
- `503` - Unhealthy (service unavailable)
- `401` - Unauthorized (missing/invalid API key)

### Client Events Logging
```http
POST /api/logs/client-events
Authorization: Bearer <token> (optional)
Content-Type: application/json

{
  "events": [
    {
      "type": "gmail_request",
      "timestamp": 1642521600000,
      "details": {
        "operation": "batch_get_messages",
        "latency": 245,
        "messageCount": 10
      }
    },
    {
      "type": "circuit_breaker", 
      "timestamp": 1642521605000,
      "details": {
        "circuitBreakerState": "open",
        "errorThreshold": 0.5
      }
    }
  ],
  "sessionId": "anonymous_session_123",
  "userAgent": "Mozilla/5.0...",
  "timestamp": 1642521600000
}
```

### Admin Metrics
```http
GET /api/logs/client-events?admin=true
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "metrics": [
    {
      "hour": 456123,
      "timestamp": 1642521600000,
      "totalEvents": 1250,
      "errorEvents": 45,
      "retryEvents": 123,
      "circuitBreakerTrips": 2,
      "averageLatency": 156,
      "uniqueSessions": 89
    }
  ],
  "summary": {
    "totalHours": 24,
    "totalEvents": 28450,
    "totalErrors": 892,
    "averageLatency": 167
  }
}
```

## 🔒 Security Features

### Rate Limiting
All API endpoints are protected with configurable rate limits:

**Default Limits (per minute):**
- General API: 100 requests
- Auth endpoints: 10 requests  
- Email sync: 50 requests
- Health checks: 20 requests

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642521660
Retry-After: 30
```

**Rate Limited Response (429):**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests, please try again later",
  "retryAfter": 30
}
```

### Content Security Policy
Dynamic nonce-based CSP with strict-dynamic:
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123' 'strict-dynamic' https://apis.google.com; ...
x-nonce: abc123
```

### Input Sanitization
- ✅ **HTML Content**: DOMPurify server-side sanitization
- ✅ **SQL Injection**: Parameterized queries only
- ✅ **XSS Protection**: CSP + input validation
- ✅ **CSRF Protection**: JWT tokens + SameSite cookies

## ⚡ Performance Features

### Caching Strategy
```http
Cache-Control: private, max-age=300
ETag: "abc123"
Last-Modified: Wed, 17 Jan 2025 10:30:00 GMT
```

**Cache Types:**
- **Intelligent Cache**: Metadata-first approach with TTL
- **Redis Cache**: Session data and rate limiting
- **Browser Cache**: Static assets and API responses

### Compression
```http
Content-Encoding: gzip
Accept-Encoding: gzip, deflate, br
```

## 🚨 Error Handling

### Standard Error Response
```json
{
  "error": "error_code",
  "message": "Human readable error message",
  "details": "Additional context or debugging info",
  "timestamp": "2025-01-17T10:30:00.000Z",
  "requestId": "req_123456"
}
```

### Common Error Codes

**Authentication Errors:**
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)

**Client Errors:**
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `422` - Unprocessable Entity (validation errors)
- `429` - Too Many Requests (rate limited)

**Server Errors:**
- `500` - Internal Server Error
- `502` - Bad Gateway (upstream service failure)
- `503` - Service Unavailable (circuit breaker open)
- `504` - Gateway Timeout

### Gmail API Error Handling
```json
{
  "error": "gmail_api_error",
  "message": "Gmail API rate limit exceeded",
  "details": {
    "retryAfter": 30,
    "quotaExceeded": true,
    "circuitBreakerState": "open"
  }
}
```

## 🔧 Configuration

### Environment Variables
Required for production deployment:

**Security:**
```bash
HEALTH_API_KEY="secure-health-key"
NEXTAUTH_SECRET="secure-32-char-secret"
```

**Rate Limiting:**
```bash
RATELIMIT_GENERAL_LIMIT="100"
RATELIMIT_AUTH_LIMIT="10"
RATELIMIT_SYNC_LIMIT="50" 
RATELIMIT_HEALTH_LIMIT="20"
```

**Infrastructure:**
```bash
DATABASE_URL="postgresql://..."
UPSTASH_REDIS_URL="redis://..."
UPSTASH_REDIS_TOKEN="redis-token"
```

### Feature Flags
Control features via environment variables:
```bash
ENABLE_CIRCUIT_BREAKER="true"
ENABLE_CLIENT_MONITORING="true"
ENABLE_INTELLIGENT_CACHE="true"
```

## 📊 Monitoring & Observability

### Metrics Available
- **Request Rate**: Requests per minute by endpoint
- **Error Rate**: Error percentage over time
- **Latency**: P50, P95, P99 response times
- **Circuit Breaker**: Trip frequency and recovery
- **Cache Hit Rate**: Cache effectiveness metrics
- **Gmail API Health**: Quota usage and errors

### Logging Format
```json
{
  "timestamp": "2025-01-17T10:30:00.000Z",
  "level": "info",
  "message": "Request processed",
  "requestId": "req_123",
  "userId": "user_456", 
  "endpoint": "/api/emails",
  "method": "GET",
  "statusCode": 200,
  "latency": 156,
  "userAgent": "Mozilla/5.0..."
}
```

## 🔄 Webhooks (Future)

### Gmail Push Notifications
```http
POST /api/webhooks/gmail
Content-Type: application/json

{
  "message": {
    "data": "base64_encoded_notification",
    "messageId": "msg_123",
    "publishTime": "2025-01-17T10:30:00.000Z"
  }
}
```

---

## 🎯 SDK & Libraries

### JavaScript/TypeScript SDK
```typescript
import { FinitoClient } from '@finito/sdk';

const client = new FinitoClient({
  apiKey: 'your-jwt-token',
  baseUrl: 'https://api.yourdomain.com'
});

// Get emails with automatic retry and circuit breaker
const emails = await client.emails.list({
  query: 'is:unread',
  limit: 20
});

// Get single email with caching
const email = await client.emails.get('message_id');
```

### Python SDK (Future)
```python
from finito import FinitoClient

client = FinitoClient(
    api_key='your-jwt-token',
    base_url='https://api.yourdomain.com'
)

emails = client.emails.list(query='is:unread', limit=20)
```

---

**🚀 This API provides enterprise-grade reliability, security, and performance while maintaining the blazing-fast speed of Finito Mail's client-first architecture!**