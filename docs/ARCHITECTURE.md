# System Architecture

**Purpose**: Detailed technical implementation guide - the "how". Contains schemas, data flows, component interactions, and implementation details.  
**For high-level overview**: See [ARCHITECTURE_SUMMARY.md](./ARCHITECTURE_SUMMARY.md) for the "what" and "why".

## Overview

This document defines the immutable system architecture for Finito Mail. It serves as the authoritative reference for all architectural decisions and system design.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
├─────────────┬─────────────────┬─────────────────────────────┤
│   Web App   │  Desktop App    │      Mobile Apps            │
│  (Next.js)  │   (Electron)    │  (React Native/PWA)         │
│      ↓             ↓                    ↓                    │
│         Direct Provider API Access (PKCE)                    │
│              ↓             ↓                                 │
│         IndexedDB     IndexedDB                             │
│         (50GB+)       (50GB+)                               │
└─────────────┴─────────────────┴─────────────────────────────┘
                       ↓ Metadata Only ↓
┌──────────────────────────────────────────────────────────────┐
│                   MINIMAL BACKEND                            │
├─────────────┬─────────────────┬─────────────────────────────┤
│   Vercel    │    Upstash      │    Cloudflare              │
│  (Auth API) │  (Rate Limit)   │  (Webhook Handler)         │
│  - PKCE     │  - 10k req free │  - 100k req/day free       │
│  - Tokens   │  - User quotas  │  - Push queue               │
└─────────────┴─────────────────┴─────────────────────────────┘
```

## Architectural Principles

### 1. Client-First Architecture
- **Principle**: 99% of operations happen client-side
- **Implementation**: Direct provider API access with PKCE OAuth
- **Benefit**: Zero server costs, infinite scalability, <50ms latency

### 2. IndexedDB as Primary Storage
- **Principle**: Browser is the database (50GB+ available)
- **Implementation**: All emails stored locally, encrypted
- **Benefit**: No server storage costs, instant access

### 3. Direct Provider Access
- **Principle**: Cut out the middleman completely
- **Implementation**: OAuth2 PKCE flow for secure client auth
- **Benefit**: No API gateway needed, no rate limit proxying

### 4. Minimal Server Footprint
- **Principle**: Server only for what browsers can't do
- **Implementation**: Auth coordination, webhook reception, push queue
- **Benefit**: $35/month serves 1000+ users

## Component Architecture

### Backend Components (Minimal)

#### 1. Auth Coordinator (Vercel Edge Functions)
```
/api/auth
├── /pkce/initiate     # Start PKCE flow
├── /pkce/callback     # Handle provider callback
├── /refresh           # Refresh tokens
└── /revoke            # Logout

/api/webhooks
├── /gmail             # Gmail push notifications
└── /outlook           # Outlook webhooks
```

#### 2. Metadata Store (Upstash Redis)
```
Keys:
├── user:{id}:last_sync      # Last sync timestamp
├── user:{id}:quota          # Rate limit tracking
├── user:{id}:devices        # Active devices
└── webhook:{id}             # Dedup webhook events

# No email content stored server-side!
```

#### 3. Push Queue (Cloudflare Workers)
```
Workers:
├── webhook-handler
│   └── Receive provider webhooks
│   └── Queue push to active clients
└── notification-pusher
    └── Send push notifications
    └── Handle offline clients
```

#### 4. Client-Side Architecture
```
Browser Runtime:
├── IndexedDB (Primary Storage)
│   ├── emails table (50GB available)
│   ├── attachments table
│   ├── search index
│   ├── sync metadata
│   ├── todos table
│   └── api_keys table (encrypted)
├── Web Workers
│   ├── Sync worker (background sync)
│   ├── Search worker (MiniSearch.js)
│   ├── AI worker (Gemini integration)
│   └── Crypto worker (encryption)
├── Service Worker
│   ├── Offline support
│   └── Push notifications
└── Window Management
    ├── Main window controller
    ├── Reference views (max 3)
    └── State synchronization
```

### Frontend Architecture

#### Monorepo Structure
```
finito-mail/
├── apps/
│   ├── web/              # Next.js 14 web application
│   ├── desktop/          # Electron desktop wrapper  
│   ├── mobile/           # React Native mobile app
│   └── auth/             # Minimal auth coordinator (Vercel Edge)
├── packages/
│   ├── @finito/core/     # Business logic, email operations
│   ├── @finito/ui/       # Shared UI components
│   ├── @finito/provider-client/ # Gmail/Outlook API clients
│   ├── @finito/storage/  # IndexedDB abstraction layer
│   ├── @finito/crypto/   # WebCrypto utilities
│   └── @finito/types/    # TypeScript types/interfaces
├── workers/
│   ├── webhook-handler/  # Cloudflare webhook receiver
│   └── push-notifier/    # Push notification sender
└── config/
    ├── vercel/           # Edge function configs
    └── cloudflare/       # Worker configurations
```

#### Shared Package Architecture

**@finito/core**
- Email operations (send, receive, search)
- Thread management (conversation grouping, threading)
- Label/folder operations
- Sync coordination
- Natural language search integration
- Export functionality (PST/MBOX/EML generation)
- Print formatting and layout

**@finito/ui**
- Shared React components
- Platform-specific implementations
- Design system tokens
- Animation primitives
- Window management system

**@finito/provider-client**
- Direct Gmail API client (PKCE)
- Direct Outlook API client (PKCE)
- Gemini Flash integration
- Request/response caching
- Error handling

**@finito/storage**
- Abstract storage interface
- Platform implementations:
  - IndexedDB (web)
  - SQLite (mobile)
  - LevelDB (desktop)
- Todo list storage schema

**@finito/crypto**
- WebCrypto API wrapper
- Token encryption/decryption
- Key derivation (PBKDF2)
- API key secure storage
- Local encryption utilities

## Data Flow Architecture

### Three-Tier State Architecture

Our architecture uses a three-tier state model that elegantly solves cross-device sync while maintaining performance:

#### Tier 1: Provider State (Gmail/Outlook)
- **Purpose**: Source of truth for all email content and standard state
- **Contains**: Emails, read/unread status, labels, folders, archives
- **Sync**: Handled automatically by the provider across all devices
- **Access**: Direct API calls via OAuth2 PKCE

#### Tier 2: Finito Metadata Service
- **Purpose**: Source of truth for Finito-specific features only
- **Contains**: Custom tags, todos, snooze times, reading positions
- **Storage**: Minimal key-value store (Upstash Redis)
- **Example**: `{userId, gmailMessageId} → {snoozeUntil: "2024-08-01", todo: "completed"}`

#### Tier 3: Local Cache (IndexedDB)
- **Purpose**: Performance layer - disposable cache of Tiers 1 & 2
- **Contains**: Replicated email data + Finito metadata for instant access
- **Rebuild**: Can be completely reconstructed from Tiers 1 & 2
- **Split Schema**: Headers for list view, bodies loaded on-demand

### Progressive Sync Strategy

To ensure emails load instantly and never hinder performance:

#### Initial Device Setup
```
1. Authenticate → Get OAuth tokens
2. Fetch first 50 messages from Inbox + Sent → Display immediately
3. Fetch Finito metadata for visible emails → Merge with headers
4. Store sync state (historyId/deltaToken) for incremental updates
5. Background: Progressively sync older emails (90 days, 1 year, all)
6. Background: Download email bodies for recent emails
7. Background: Build search indices as data arrives
```

#### Sync Prioritization
```
Priority 1 (Instant): 
- First 50 messages from current folder (default: Inbox)
- First 50 messages from Sent folder
- Finito metadata for visible emails
- Store sync tokens for incremental updates

Priority 2 (Background - Fast):
- Email bodies for last 7 days
- Headers for last 90 days
- Frequently accessed labels

Priority 3 (Background - Slow):
- Email bodies for last 30 days
- Headers for last year
- Search index building

Priority 4 (Background - Idle):
- All historical emails
- Attachment metadata
- Full archive
```

#### Performance Guarantees
- **First paint**: <1 second (show UI with loading state)
- **First emails visible**: <3 seconds (most recent headers)
- **Fully interactive**: <5 seconds (can read, search, compose)
- **Background sync**: Never blocks UI, uses requestIdleCallback

### Client-First Email Sync
```
1. Client → Direct Gmail/Outlook API call
2. Fetch emails → Store in IndexedDB
3. Background: Provider → Webhook → Cloudflare
4. Push notification → Active clients
5. Client pulls changes → Direct API
6. No server storage of email content!
```

### Optimistic UI Pattern

All user actions update immediately with background sync:

```
1. User Action (e.g., archive email)
2. Immediate UI Update (remove from inbox view)
3. Update local IndexedDB state
4. Queue background API call to provider
5. If API succeeds → State confirmed
6. If API fails → Must handle failure:
   a. Revert IndexedDB state
   b. Restore UI (add email back)
   c. Show non-intrusive error toast
   d. Log error for debugging
```

**Critical**: Every optimistic action MUST have a corresponding failure handler. This ensures <50ms response times while maintaining data integrity.

### Error Recovery Patterns

```typescript
// Example: Robust archive operation
async function archiveEmail(messageId: string) {
  // 1. Optimistic UI update
  removeFromInboxView(messageId);
  
  // 2. Store rollback state
  const rollbackState = await getEmailState(messageId);
  
  // 3. Update local DB
  await db.email_headers.update(messageId, {
    labels: labels.filter(l => l !== 'INBOX')
  });
  
  try {
    // 4. Background API call
    await gmailClient.modifyLabels(messageId, 
      { remove: ['INBOX'] }
    );
  } catch (error) {
    // 5. Rollback everything
    await db.email_headers.update(messageId, rollbackState);
    addToInboxView(messageId);
    showToast('Failed to archive email', { type: 'error' });
  }
}
```

### Authentication Flow (PKCE)
```
1. Client generates code_verifier
2. Client → Auth server (initiate)
3. Redirect → Provider OAuth
4. Provider → Callback with code
5. Client exchanges code → Tokens
6. Tokens stored encrypted locally
7. Server never sees tokens!
```

### Search Architecture

#### Traditional Search
```
Client Query → MiniSearch.js (Web Worker)
     ↓
IndexedDB Full-Text Search
     ↓
Instant Results (<10ms)

# No server search needed!
- All emails indexed locally
- Supports 1M+ emails
- Full-text, fuzzy matching
- Zero network latency
```

#### Natural Language Search (AI-Powered)
```
User Query (\) → Intent Detection
     ↓
Complex Query? → Gemini Flash API
     ↓              ↓
Parse Intent    Cache Results
     ↓              ↓
Build Filter    24hr TTL
     ↓
MiniSearch Query → Results

# Gemini Flash Integration
- User provides Google API key
- 1M requests/month free tier
- 32k token context window
- <100ms response time
- Fallback to local search
```

### Storage Strategy

#### Memory (RAM) - 100MB
- Currently viewing emails
- Active thread
- Recent searches
- UI state

#### IndexedDB - 50GB+
- ALL emails (no limit)
- Full attachments
- Search indices
- Thread relationships
- Encrypted with WebCrypto

##### Split Schema Design
To optimize performance with large datasets:

```typescript
// Headers table - for list views (small, fast)
// Indexes: ['date', 'threadId', 'labels', '[isRead, date]']
email_headers: {
  id: string;              // Provider's message ID (Primary Key)
  threadId: string;
  from: { name?: string; email: string };
  to: { name?: string; email: string }[];
  subject: string;
  snippet: string;         // First 100 chars
  date: number;            // Unix timestamp for efficient sorting
  isRead: 0 | 1;          // 0/1 for better index performance
  labels: string[];        // Indexed with multiEntry: true
  hasAttachment: boolean;
}

// Bodies table - loaded on demand (large, lazy)
email_bodies: {
  id: string;              // matches header.id (Primary Key)
  bodyText: string;
  bodyHtml: string;
  attachments: {           // Metadata only, no blobs!
    id: string;
    filename: string;
    size: number;
    contentType: string;
  }[];
}

// Finito-specific metadata (cached from Tier 2)
finito_metadata: {
  messageId: string;       // matches header.id (Primary Key)
  snoozeUntil?: number;
  todoId?: string;
  customTags?: string[];
  readingPosition?: number;
  // ... other Finito features
}

// Attachment cache with LRU eviction
attachment_cache: {
  attachmentId: string;    // Provider's attachment ID (Primary Key)
  messageId: string;       // For context
  blob: Blob;             // Actual file content
  lastAccessed: number;    // For LRU eviction
  size: number;           // For quota management
}

// Sync state tracking
sync_state: {
  folderId: string;        // e.g., 'INBOX', 'SENT' (Primary Key)
  historyId?: string;      // Gmail's history ID
  deltaToken?: string;     // Outlook's delta token
  lastSync: number;        // Unix timestamp
  totalMessages: number;   // For progress tracking
}

// Enables instant list rendering while keeping memory low
```

##### Thread Storage Schema
```typescript
// Conversation/Thread grouping
interface ThreadStore {
  threads: {
    id: string;
    subject: string;
    messageIds: string[];
    participants: string[];
    lastActivity: Date;
    labels: string[];
  };
  
  messages: {
    id: string;
    threadId: string;
    messageId: string; // RFC Message-ID
    inReplyTo?: string;
    references?: string[];
    date: Date;
  };
}
```

#### Provider (Gmail/Outlook)
- Source of truth
- Webhook notifications
- Direct API access
- No middleware needed

#### Key Insights:
- Modern browsers support 50GB+ storage
- WhatsApp Web stores years of messages
- No artificial limits needed
- Users own their data

## Security Architecture

### Encryption Layers
```
1. Transport Security
   └── HTTPS/TLS 1.3 for all connections

2. Authentication Tokens
   └── OAuth tokens encrypted with AES-256-GCM
   └── Master key in Vercel Edge Config
   └── Per-user salt in database
   └── Automatic token refresh before expiry

3. Email Content
   └── Server-side encryption by default
   └── Optional client-side encryption
   └── Keys derived from user password

4. Local Storage
   └── Platform encryption APIs
   └── Additional app-level encryption

5. XSS Protection
   └── Content Security Policy (CSP) headers
   └── Trusted Types for DOM manipulation
   └── DOMPurify for email content sanitization
```

### OAuth Token Management

```typescript
// packages/provider-client/src/auth/token-manager.ts
export class SecureTokenManager {
  private refreshTimer?: NodeJS.Timeout;
  
  async initialize() {
    const tokens = await this.getStoredTokens();
    if (tokens) {
      this.scheduleTokenRefresh(tokens.expiresIn);
    }
  }
  
  private scheduleTokenRefresh(expiresIn: number) {
    // Refresh 5 minutes before expiration
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
    // Call backend endpoint - refresh token never leaves server
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
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

### Content Security Policy

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

### Authentication Flow
```
1. User enters email
2. Redirect to OAuth provider
3. Receive authorization code
4. Exchange for tokens
5. Backend stores refresh token securely
6. Return access token to client
7. Schedule automatic token refresh
8. Set secure session cookie
```

## Scalability Architecture

### Infinite Scalability by Design
1. **No Server Bottleneck**: Clients talk directly to providers
2. **No Database Limits**: Each user is their own database
3. **No Infrastructure Scaling**: Browser does the work
4. **No Cost Scaling**: $35/month for 1 user or 10,000

### Why Gmail/Outlook as Your Database Works
- **Gmail handles 1.8B users** - We're just another email client
- **Provider manages sync** - Cross-device consistency solved
- **Natural conflict resolution** - Provider state always wins
- **No data duplication** - Single source of truth
- **Generous rate limits** - Designed for client access

### Performance Characteristics
```
Operation          | Latency | Server Load
-------------------|---------|-------------
Email List         | <50ms   | Zero
Search             | <10ms   | Zero  
Open Email         | <5ms    | Zero
Send Email         | <200ms  | Zero
Background Sync    | N/A     | Webhook only
```

### Why This Works
- Gmail handles 1.8B users
- We're just a smart client
- No data duplication
- Provider rate limits are generous
- 15k emails/user average = 750MB

## Monitoring Architecture

### Key Metrics
1. **Performance**
   - API response times
   - Client render times
   - Search query performance
   - Sync latency

2. **Reliability**
   - Uptime percentage
   - Error rates
   - Queue depths
   - Webhook success rates

3. **Usage**
   - Active users
   - API calls per user
   - Storage per user
   - Bandwidth consumption

### Alerting Thresholds
- API response time > 200ms
- Error rate > 1%
- Queue depth > 1000
- Storage usage > 80% of quota

## Window Management Architecture

### Reference View System
```
Main Window
├── Email List (40%)
├── Email View (60%)
└── State Manager
    ├── Active email ID
    ├── Selection state
    └── View preferences

Reference Windows (1-3)
├── Independent Email View
├── Shared IndexedDB access
├── State sync via BroadcastChannel
└── Window positioning
    ├── Snap to edges
    ├── Stack with offset
    └── Remember positions
```

### State Synchronization
```typescript
// BroadcastChannel for cross-window communication
const channel = new BroadcastChannel('email-sync');

// Sync events
- Email marked as read
- Email archived/deleted
- Labels changed
- Todo status updated

// Each window maintains:
- Own scroll position
- Own selection
- Shared data state
```

## Todo System Architecture

### Storage Schema
```typescript
// IndexedDB tables
todos: {
  id: string;
  title: string;
  description?: string;
  emailId?: string;      // Linked email
  threadId?: string;     // Linked thread
  dueDate?: Date;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  priority: 'low' | 'medium' | 'high';
  labels: string[];
}

todo_email_links: {
  todoId: string;
  emailId: string;
  linkType: 'reference' | 'action';
}
```

### Todo Panel Integration
```
Email Actions → Todo Creation
     ↓
Quick Add (t key)
     ↓
Todo Panel (right sidebar)
     ↓
Synced across windows
```

## Natural Language Search Architecture

### Gemini Flash Integration
```
User Types "\" → Search Panel Opens
     ↓
Natural Language Query
     ↓
Local Intent Detection
     ↓
Simple Query? → MiniSearch
     ↓
Complex Query? → Gemini Flash
     ↓
API Response → Parse Filters
     ↓
Execute Search → Display Results

# Query Examples → Gemini Interpretation
"emails from john about project" → {
  from: "john",
  subject: "project",
  body: "project"
}

"unread with attachments this week" → {
  isRead: false,
  hasAttachment: true,
  after: "2024-01-08"
}

"emails I haven't replied to" → {
  requiresReply: true,
  repliedTo: false
}
```

### API Key Management
```typescript
// Secure storage in IndexedDB
api_keys: {
  provider: 'google';
  encryptedKey: string;  // AES-256-GCM
  iv: Uint8Array;
  createdAt: Date;
  lastUsed: Date;
}

// First-time setup flow
1. Prompt for API key
2. Validate with test query
3. Encrypt with user passphrase
4. Store in IndexedDB
5. Never sent to server
```

## Disaster Recovery

### Backup Strategy
1. **Database**: Daily automated backups
2. **User Data**: Encrypted export capability
3. **Configuration**: Version controlled
4. **Secrets**: Secure backup in multiple locations

### Failure Modes
1. **Provider Webhook Failure**: Fall back to periodic sync
2. **Database Outage**: Read from local cache
3. **API Degradation**: Offline mode activation
4. **Edge Worker Failure**: Direct origin requests

## Commercial SaaS Considerations

### Multi-Tenancy Architecture
1. **User Isolation**: Complete data separation per customer
2. **Resource Quotas**: Fair usage limits per subscription tier
3. **Performance Isolation**: No single user can impact others
4. **Billing Integration**: Usage tracking for metered features

### Subscription Management
1. **Payment Processing**: Stripe integration for billing
2. **Trial Management**: 30-day free trial with full features
3. **Plan Enforcement**: Feature flags based on subscription tier
4. **Usage Analytics**: Track feature adoption and engagement

### Enterprise Readiness
1. **SSO Support**: SAML/OAuth for enterprise customers
2. **Audit Logging**: Compliance and security tracking
3. **SLA Monitoring**: Uptime and performance guarantees
4. **Dedicated Instances**: Isolated deployments for large customers

## Client-First Benefits

### Cost Reduction (99%)
```
Traditional Architecture:
- Database: $129/mo (10GB)
- Compute: $500/mo 
- Storage: $200/mo (S3)
- Redis: $200/mo
- CDN: $100/mo
Total: $1,129/mo for 1000 users

Client-First Architecture:
- Vercel: $20/mo (auth only)
- Upstash: $0 (free tier)
- Cloudflare: $0 (free tier)
Total: $20/mo for 1000 users
```

### Performance Benefits
- No network latency for reads
- Instant search (local index)
- Works offline completely
- No server load = no slowdowns

### Privacy Benefits  
- Emails never touch our servers
- End-to-end encryption possible
- User owns their data
- GDPR compliant by design

---

**Note**: This architecture is designed to start within free tier limits during early development and beta testing. As a commercial SaaS product, we'll progressively scale to paid tiers as our subscriber base grows, maintaining the same architectural principles while ensuring reliable service for paying customers.
## Modifier Queue Pattern (Inspired by Superhuman)

### Overview
The Modifier Queue pattern enables instant UI updates with background synchronization, providing a responsive user experience even with API rate limits or offline conditions.

### Architecture
Every user action follows a two-phase pattern:

```typescript
interface Modifier<T> {
  // Phase 1: Instant local update (synchronous)
  modify(data: T): void;
  
  // Phase 2: Queued API persistence (asynchronous)
  persist(): Promise<void>;
}

// Example: Archive Email Modifier
class ArchiveEmailModifier implements Modifier<Email> {
  constructor(
    private emailId: string,
    private userId: string
  ) {}
  
  modify(email: Email) {
    // Instant UI update - no network latency
    email.labels = email.labels.filter(l => l \!== "INBOX");
    email.archived = true;
    
    // Update IndexedDB immediately
    db.email_headers.update(this.emailId, {
      labels: email.labels,
      archived: true
    });
  }
  
  async persist() {
    // Queued for background sync with Gmail API
    await gmailClient.modifyLabels(this.emailId, {
      removeLabelIds: ["INBOX"]
    });
    
    // Update sync metadata
    await redis.hset(`user:${this.userId}:message:${this.emailId}`, {
      archived: true,
      archivedAt: new Date().toISOString()
    });
  }
}
```

### Benefits

1. **Instant Responsiveness**: UI updates happen immediately without waiting for network
2. **Offline Capability**: Actions queue locally and sync when connection returns
3. **Rate Limit Resilience**: Automatic retry with exponential backoff
4. **Data Consistency**: Failed operations can be reverted with proper error handling
5. **User Trust**: Users see their actions take effect immediately

### Desktop vs Web Considerations

For the desktop app, the modifier queue can leverage:
- More aggressive local caching (3-6 months vs 30 days)
- Background processing without browser limitations
- Native file system for queue persistence
- OS-level network state detection

## Resilience Patterns

### Circuit Breaker Pattern

Prevents cascading failures when external services (Gmail/Outlook APIs) experience issues:

```typescript
// packages/core/src/resilience/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private successCount = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly options: {
      failureThreshold: number;
      resetTimeout: number;
      halfOpenRetries: number;
      onStateChange?: (state: string) => void;
    }
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.options.resetTimeout) {
        this.state = 'half-open';
        this.options.onStateChange?.('half-open');
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
}

// Usage with Gmail API
const gmailCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRetries: 3,
  onStateChange: (state) => {
    metrics.record('circuit_breaker_state', { service: 'gmail', state });
  }
});
```

### Rate Limiting

Client-side rate limiting to prevent API quota abuse:

```typescript
// apps/auth/api/middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true
});

export async function rateLimitMiddleware(request: Request): Promise<Response | null> {
  const userId = await getUserId(request);
  const identifier = `${userId}:${request.method}:${new URL(request.url).pathname}`;
  
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  if (!success) {
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
  
  return null;
}
```

### Quota Management

Track and predict Gmail API quota usage:

```typescript
// packages/core/src/quota/quota-tracker.ts
export class QuotaTracker {
  private readonly QUOTA_LIMIT = 250; // units per second per user
  
  async trackOperation(userId: string, units: number) {
    const key = `quota:${userId}:${Math.floor(Date.now() / 1000)}`;
    const current = await redis.incrby(key, units);
    await redis.expire(key, 60); // 1 minute TTL
    
    if (current > this.QUOTA_LIMIT * 0.8) {
      // Alert when approaching limit
      await this.alertHighUsage(userId, current);
    }
    
    return current <= this.QUOTA_LIMIT;
  }
}
```

## Performance Optimization

### Memory Management

Prevents browser crashes with large email datasets:

```typescript
// packages/core/src/memory/memory-manager.ts
export class MemoryManager {
  private memoryPressureCallbacks: Set<() => void> = new Set();
  
  constructor() {
    this.startMemoryMonitoring();
  }
  
  private startMemoryMonitoring() {
    setInterval(() => {
      this.checkMemoryPressure();
    }, 10000); // Check every 10 seconds
    
    // Listen for memory pressure events (Chrome 91+)
    if ('memory' in performance && 'addEventListener' in performance.memory) {
      (performance.memory as any).addEventListener('pressure', (event: any) => {
        this.handleMemoryPressure(event.level);
      });
    }
  }
  
  private async checkMemoryPressure() {
    if (!('memory' in performance)) return;
    
    const memory = (performance as any).memory;
    const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    
    if (usageRatio > 0.9) {
      await this.handleMemoryPressure('critical');
    } else if (usageRatio > 0.7) {
      await this.handleMemoryPressure('moderate');
    }
  }
  
  private async handleMemoryPressure(level: 'moderate' | 'critical') {
    this.memoryPressureCallbacks.forEach(callback => callback());
    
    if (level === 'critical') {
      // Clear email bodies from memory
      await db.email_bodies.clear();
      // Clear search index
      if (window.searchWorker) {
        window.searchWorker.postMessage({ type: 'CLEAR_INDEX' });
      }
    }
  }
}
```

### IndexedDB Optimization

Archive and compress old emails for performance:

```typescript
// packages/storage/src/performance/db-optimizer.ts
export class DatabaseOptimizer {
  private readonly ARCHIVE_THRESHOLD_DAYS = 90;
  private readonly COMPRESSION_THRESHOLD_SIZE = 1024 * 1024; // 1MB
  
  async optimizeStorage(): Promise<OptimizationResult> {
    const result = {
      archivedCount: 0,
      compressedCount: 0,
      spaceSaved: 0
    };
    
    // Archive old emails
    const cutoffDate = Date.now() - (this.ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    
    const oldEmails = await db.email_headers
      .where('date')
      .below(cutoffDate)
      .toArray();
    
    for (const header of oldEmails) {
      const body = await db.email_bodies.get(header.id);
      if (body && body.bodyHtml.length > this.COMPRESSION_THRESHOLD_SIZE) {
        const compressed = await this.compressEmailBody(body);
        await db.archived_emails.add({
          ...header,
          bodyCompressed: compressed,
          archivedAt: Date.now()
        });
        result.archivedCount++;
      }
    }
    
    return result;
  }
}
```

## Data Integrity

### Sync Validation

Ensure consistency between local and server data:

```typescript
// packages/core/src/integrity/data-validator.ts
export class DataIntegrityValidator {
  async validateDataIntegrity(): Promise<ValidationReport> {
    const report: ValidationReport = {
      timestamp: new Date(),
      errors: [],
      warnings: []
    };
    
    // Compare local count with Gmail
    const localCount = await db.email_headers.count();
    const gmailCount = await this.getGmailMessageCount();
    
    if (Math.abs(localCount - gmailCount) > 10) {
      report.errors.push({
        type: 'EMAIL_COUNT_MISMATCH',
        message: `Local: ${localCount}, Gmail: ${gmailCount}`,
        severity: 'high',
        action: 'RESYNC_REQUIRED'
      });
    }
    
    return report;
  }
}
```

## Observability

### Logging Strategy

All services use structured JSON logging with consistent fields:

```typescript
interface LogEntry {
  timestamp: string;      // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;        // 'api' | 'sync' | 'webhook'
  userId?: string;        // Always included when available
  operationId: string;    // UUID for tracing requests
  message: string;
  metadata?: any;         // Additional context
}

// Example log entry
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "service": "sync",
  "userId": "user123",
  "operationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Sync completed",
  "metadata": {
    "emailsSynced": 1523,
    "duration": 45623,
    "provider": "gmail"
  }
}
```

### Key Performance Indicators (KPIs)

Monitor these metrics for system health:

1. **Modifier Queue Depth**: Alert if >1000 items for >10 minutes
2. **API Proxy p95 Latency**: Target <500ms, alert if >2s
3. **Gmail API Error Rate**: Alert if >5% errors in 5-minute window
4. **Sync Job Failure Rate**: Alert if >10% failures in 1 hour
5. **WebSocket Connection Count**: Track active real-time connections

### Monitoring Stack

```typescript
// Metrics collection with Prometheus format
export const metrics = {
  modifierQueueDepth: new Gauge({
    name: 'modifier_queue_depth',
    help: 'Number of pending modifier operations'
  }),
  
  apiLatency: new Histogram({
    name: 'api_request_duration_seconds',
    help: 'API request latency',
    labelNames: ['method', 'endpoint', 'status']
  }),
  
  syncJobsTotal: new Counter({
    name: 'sync_jobs_total',
    help: 'Total sync jobs processed',
    labelNames: ['status', 'provider']
  })
};
```

### Alerting Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Queue Depth | >1000 items for 10min | Warning | Check for API issues |
| API Latency | p95 >2s for 5min | Critical | Scale API servers |
| Gmail Rate Limit | >10% 429s | Warning | Reduce sync rate |
| Sync Failures | >10% in 1hr | Critical | Check provider status |
| Low Disk Space | <10% free | Critical | Clean old logs |

## Client Database Migration

### Schema Versioning with Dexie.js

```typescript
// packages/storage/src/database.ts
import Dexie from 'dexie';

class FinitoDatabase extends Dexie {
  constructor() {
    super('FinitoMail');
    
    // Version 1: Initial schema
    this.version(1).stores({
      email_headers: 'id, threadId, date, [isRead+date]',
      email_bodies: 'id',
      finito_metadata: 'messageId'
    });
    
    // Version 2: Add snooze support
    this.version(2).stores({
      email_headers: 'id, threadId, date, [isRead+date], snoozeUntil',
      email_bodies: 'id',
      finito_metadata: 'messageId',
      snoozed_emails: 'id, snoozeUntil' // New table
    }).upgrade(tx => {
      // Migrate existing snoozed emails
      return tx.finito_metadata.toCollection()
        .filter(m => m.snoozeUntil)
        .each(m => {
          tx.snoozed_emails.add({
            id: m.messageId,
            snoozeUntil: m.snoozeUntil
          });
        });
    });
  }
}
```

### Migration Process

1. **Version Increment**: Always increment DB version for schema changes
2. **Non-Destructive**: Migrations must preserve existing data
3. **Backward Compatible**: Handle users on older app versions
4. **Testing**: Test migrations with production-size datasets

### Migration Checklist

When changing IndexedDB schema:
- [ ] Increment version number in `db.version(X)`
- [ ] Write upgrade function for version transition
- [ ] Test with empty database (new user)
- [ ] Test with existing data (upgrade path)
- [ ] Test with large dataset (50k+ emails)
- [ ] Document migration in changelog
- [ ] Consider impact on active users

## Error Recovery Strategies

### Sync Failure Recovery

```typescript
class SyncRecovery {
  async handleSyncFailure(error: Error, checkpoint: SyncCheckpoint) {
    // 1. Log detailed error context
    logger.error('Sync failed', {
      error,
      checkpoint,
      userId: checkpoint.userId,
      operationId: this.operationId
    });
    
    // 2. Determine if retryable
    if (this.isRetryable(error)) {
      // Exponential backoff
      const delay = Math.min(
        1000 * Math.pow(2, checkpoint.failureCount),
        300000 // Max 5 minutes
      );
      
      await this.scheduleRetry(checkpoint, delay);
    } else {
      // Non-retryable, notify user
      await this.notifyUser(checkpoint.userId, {
        type: 'SYNC_FAILED',
        error: error.message
      });
    }
    
    // 3. Update checkpoint with failure
    await this.updateCheckpoint({
      ...checkpoint,
      failureCount: checkpoint.failureCount + 1,
      lastFailure: new Date()
    });
  }
}
```

### Client Reconnection

```typescript
class ConnectionManager {
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds
  
  async handleDisconnect() {
    const delay = Math.min(
      1000 * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    
    setTimeout(() => {
      this.connect().then(() => {
        this.reconnectAttempts = 0;
        this.syncPendingOperations();
      });
    }, delay);
  }
}
```

