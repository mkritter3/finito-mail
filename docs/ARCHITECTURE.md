# System Architecture

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

### Client-First Email Sync
```
1. Client → Direct Gmail/Outlook API call
2. Fetch emails → Store in IndexedDB
3. Background: Provider → Webhook → Cloudflare
4. Push notification → Active clients
5. Client pulls changes → Direct API
6. No server storage of email content!
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

3. Email Content
   └── Server-side encryption by default
   └── Optional client-side encryption
   └── Keys derived from user password

4. Local Storage
   └── Platform encryption APIs
   └── Additional app-level encryption
```

### Authentication Flow
```
1. User enters email
2. Redirect to OAuth provider
3. Receive authorization code
4. Exchange for tokens
5. Encrypt tokens with user key
6. Store encrypted tokens
7. Set session cookie
```

## Scalability Architecture

### Infinite Scalability by Design
1. **No Server Bottleneck**: Clients talk directly to providers
2. **No Database Limits**: Each user is their own database
3. **No Infrastructure Scaling**: Browser does the work
4. **No Cost Scaling**: $35/month for 1 user or 10,000

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