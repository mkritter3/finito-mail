# Technology Stack

## Overview

This document defines the complete technology stack for Finito Mail. Every technology choice is made with specific rationale considering performance, cost, developer experience, and scalability.

## Core Principles

1. **Client-First Architecture**: 99% of operations happen in the browser
2. **Zero Server Storage**: All emails stored client-side in IndexedDB
3. **Direct Provider Access**: Cut out the middleman completely
4. **Performance First**: <50ms for all interactions (no network)
5. **Infinite Scalability**: Each user is their own database

## Frontend Technologies

### Web Application

#### Framework: Next.js 14+
- **Why**: Server Components for instant first load, App Router for modern React patterns
- **Alternatives Considered**: Remix, SvelteKit, Nuxt
- **Decision Factors**: 
  - Best Vercel integration (our deployment target)
  - Excellent performance with ISR/SSG
  - Strong ecosystem and community
  - React Server Components support

#### UI Framework: React 18+
- **Why**: Industry standard, excellent ecosystem, concurrent features
- **Version**: 18.2+ (for Suspense and transitions)
- **Key Features Used**:
  - Server Components
  - Suspense boundaries
  - Concurrent rendering
  - Automatic batching

#### Styling: Tailwind CSS 3+
- **Why**: Utility-first, excellent performance, small bundle size
- **Alternatives Considered**: CSS Modules, Emotion, Styled Components
- **Decision Factors**:
  - No runtime overhead
  - Excellent purging for small bundles
  - Rapid development
  - Design system friendly

#### State Management

**Local State: Zustand 4+**
- **Why**: Simple, performant, TypeScript-first
- **Use Cases**: UI state, user preferences, sync status
- **Size**: ~8KB minified

**Email Storage: Dexie.js (IndexedDB)**
- **Why**: 50GB+ storage, full-text search, reactive queries
- **Features Used**:
  - Virtual tables for large datasets
  - Compound indexes for performance
  - Observable queries
  - Bulk operations

#### Performance Libraries

**Virtual Scrolling: @tanstack/react-virtual**
- **Why**: Handle 100k+ emails smoothly
- **Use Cases**: Email lists, search results

**Search Engine: MiniSearch**
- **Why**: Full-text search in browser, 50KB size
- **Features**: Fuzzy matching, field boosting, auto-suggest
- **Performance**: Search 100k emails in <10ms

**Natural Language Search: Gemini Flash API**
- **Why**: Free tier with 1M requests/month, fast responses
- **Model**: gemini-1.5-flash
- **Features**: 
  - Natural language understanding
  - Complex query interpretation
  - Context-aware filtering
- **Integration**: Direct from browser, user's API key

**Web Workers: Comlink**
- **Why**: Move heavy computation off main thread
- **Use Cases**: Search indexing, sync, encryption

**Animation: Framer Motion 10+**
- **Why**: Declarative, performant, gesture support
- **Use Cases**: Panel slides, transitions, micro-interactions

**Keyboard Shortcuts: react-hotkeys-hook**
- **Why**: Declarative API, excellent performance
- **Features**: Scoped shortcuts, platform detection

**Window Management: Floating UI**
- **Why**: Positioning engine for reference views
- **Features**: Auto-placement, collision detection

**Accessibility: Radix UI**
- **Why**: Unstyled, accessible components
- **Use Cases**: Command palette, dropdowns, modals
- **Use Cases**: Page transitions, micro-interactions

### Mobile Application

#### Framework: React Native 0.72+
- **Why**: Code sharing with web, mature ecosystem
- **Alternatives Considered**: Flutter, Native development
- **Decision Factors**:
  - 70% code reuse with web
  - JavaScript ecosystem
  - Hot reload development
  - Native module support

#### Navigation: React Navigation 6+
- **Why**: De facto standard, native performance
- **Features**: Stack, tab, and drawer navigators

#### Storage: React Native SQLite Storage
- **Why**: Better performance than AsyncStorage
- **Use Cases**: Email caching, offline support

#### Platform-Specific

**iOS**:
- Notification: PushNotificationIOS
- Background: react-native-background-fetch

**Android**:
- Notification: Firebase Cloud Messaging
- Background: react-native-background-task

### Desktop Application

#### Framework: Electron 25+
- **Why**: Web technology reuse, cross-platform
- **Alternatives Considered**: Tauri, Native development
- **Features Used**:
  - Auto-updater
  - System tray
  - Global shortcuts
  - Native menus

#### Bundler: Electron Forge
- **Why**: Official tooling, best practices built-in
- **Features**: Code signing, auto-update, installers

## Backend Technologies

### API Layer

#### Runtime: Node.js 18+ LTS
- **Why**: JavaScript everywhere, excellent performance
- **Features Used**: Native fetch, crypto APIs

#### API Framework: Minimal REST API
- **Why**: Simplest possible backend for auth and webhooks only
- **Alternatives Considered**: GraphQL, tRPC, gRPC
- **Decision Factors**:
  - Client-first architecture requires minimal backend
  - Only need auth coordination and webhook handling
  - REST is simpler for these basic operations
  - No need for complex data fetching patterns

#### Serverless Platform: Vercel Functions
- **Why**: Generous free tier, excellent Next.js integration
- **Limits**: 100GB bandwidth/month free
- **Features Used**:
  - Edge Functions
  - Streaming responses
  - Regional deployments

### Client-Side Storage

#### Primary Storage: IndexedDB
- **Why**: 50GB+ available, no server costs
- **Wrapper**: Dexie.js for better API
- **Features**:
  - Full-text search indexes
  - Encrypted storage
  - Offline-first
  - No size limits

#### Search Index: MiniSearch in Web Worker
- **Why**: Instant search without server
- **Performance**: <10ms for 100k emails
- **Features**: Fuzzy matching, stemming

### Minimal Backend Services

#### Auth Coordinator: Vercel Edge Functions
- **Why**: PKCE flow coordination only
- **Free Tier**: 100GB bandwidth/month
- **No email storage**: Tokens only

#### Rate Limiter: Upstash Redis
- **Why**: Prevent provider API abuse
- **Free Tier**: 10,000 commands/day
- **Stores**: Quotas and sync timestamps only

#### Push Queue: Cloudflare Workers
- **Why**: Webhook handling, push notifications
- **Free Tier**: 100,000 requests/day
- **No storage**: Just event routing

### Client-Side Technologies

#### Service Worker
- **Framework**: Workbox 7+
- **Features**:
  - Offline support
  - Background sync
  - Push notifications
  - Cache strategies

#### Web Crypto API
- **Why**: Native browser encryption
- **Algorithms**: AES-256-GCM
- **Use Cases**: Token encryption, email encryption

#### Background Sync API
- **Why**: Reliable offline sync
- **Features**: Retry logic, queue management

## AI Integration Stack

### Natural Language Processing: Gemini Flash
- **Model**: gemini-1.5-flash
- **Why**: Best free tier (1M requests/month)
- **Token Limit**: 32,768 context window
- **Use Cases**:
  - Natural language email search
  - Smart reply suggestions
  - Email summarization
  - Todo extraction from emails

### Client-Side AI Architecture
```
User Query → Local Processing
     ↓
Simple Intent? → MiniSearch
     ↓
Complex Query? → Gemini Flash API
     ↓
Results Caching (24hr)
```

### API Key Management
- **Storage**: Encrypted in IndexedDB
- **Encryption**: WebCrypto API (AES-256-GCM)
- **Access**: Never sent to our servers
- **Validation**: Test query on setup

## Development Tools

### Language: TypeScript 5+
- **Why**: Type safety, excellent IDE support
- **Configuration**: Strict mode enabled
- **Features Used**:
  - Strict null checks
  - Template literal types
  - Discriminated unions

### Monorepo Management: Turborepo
- **Why**: Fast, intelligent caching
- **Features Used**:
  - Remote caching
  - Parallel execution
  - Dependency graph

### Package Manager: pnpm 8+
- **Why**: Fast, efficient disk usage
- **Features Used**:
  - Workspace support
  - Strict dependencies
  - Patches support

### Build Tools

**Bundler: Vite 4+ (for packages)**
- **Why**: Fast development, excellent HMR
- **Use Cases**: Package development

**Compiler: SWC**
- **Why**: Rust-based, 20x faster than Babel
- **Integration**: Next.js built-in

### Code Quality

**Linting: ESLint 8+**
- **Config**: Extends Next.js, React Native
- **Plugins**: TypeScript, React Hooks, Import

**Formatting: Prettier 3+**
- **Config**: Standard with 2 spaces
- **Integration**: Pre-commit hooks

**Type Checking: TypeScript**
- **Mode**: Strict
- **Coverage**: 100% of codebase

**Testing**:
- **Unit**: Vitest (fast, Vite-based)
- **Integration**: Jest + React Testing Library
- **E2E**: Playwright (cross-browser)

### Version Control

**Git Workflow**: GitHub Flow
- **Branches**: main + feature branches
- **Protection**: Required reviews, CI passing

**Commit Convention**: Conventional Commits
- **Format**: `type(scope): message`
- **Automation**: Semantic release

## External Services

### Direct Provider Access

**Gmail API**
- **Auth**: OAuth 2.0 with PKCE (no server)
- **Features**: Direct API calls from browser
- **Quotas**: 1B requests/day free
- **Key Insight**: Browser can call Gmail directly!

**Microsoft Graph API**
- **Auth**: OAuth 2.0 with PKCE
- **Features**: Direct browser access
- **Quotas**: 10k requests/10min
- **No proxy needed**: CORS enabled!

### Authentication

**Provider: Native OAuth**
- **Why**: Direct integration, no middleman
- **Security**: PKCE flow
- **Storage**: Encrypted tokens

### Monitoring

**Error Tracking: Sentry**
- **Free Tier**: 5K errors/month
- **Features**: Source maps, replay

**Analytics: Plausible**
- **Why**: Privacy-focused, lightweight
- **Alternative**: Self-hosted Umami

**Uptime: Better Uptime**
- **Free Tier**: 10 monitors
- **Features**: Global monitoring

## Security Technologies

### Encryption

**Library: WebCrypto API**
- **Why**: Native, performant, secure
- **Algorithms**:
  - AES-256-GCM (symmetric)
  - PBKDF2 (key derivation)
  - RSA-OAEP (asymmetric)

**Token Storage: Encrypted IndexedDB/SQLite**
- **Encryption**: App-level + platform level
- **Key Management**: Derived from user password

### Transport Security

**Protocol: TLS 1.3**
- **Enforcement**: HSTS headers
- **Certificate**: Let's Encrypt (Vercel managed)

## Platform-Specific Technologies

### Web Storage Architecture
```
Browser Storage Hierarchy:
├── Memory (100MB)
│   └── Active emails, UI state
├── IndexedDB (50GB+)
│   ├── emails table
│   ├── attachments table
│   ├── search_index table
│   └── sync_metadata table
└── Service Worker Cache
    └── Static assets only
```

### iOS
- **Push**: Apple Push Notification Service
- **Keychain**: Secure credential storage
- **Background**: BGTaskScheduler

### Android
- **Push**: Firebase Cloud Messaging
- **Storage**: Encrypted SharedPreferences
- **Background**: WorkManager

### Desktop
- **Updates**: electron-updater
- **Storage**: electron-store
- **IPC**: Context bridge pattern

## Infrastructure as Code

**Tool: Terraform**
- **Why**: Declarative, multi-provider
- **Providers**: Vercel, Supabase, Cloudflare

**CI/CD: GitHub Actions**
- **Why**: Native GitHub integration
- **Features**: Matrix builds, caching

## Client-First Technology Benefits

| Technology | Traditional Cost | Client-First Cost | Savings |
|------------|-----------------|-------------------|----------|
| Database | $129/mo | $0 (IndexedDB) | 100% |
| Search | $89/mo | $0 (MiniSearch) | 100% |
| Storage | $200/mo | $0 (Browser) | 100% |
| CDN | $100/mo | $0 (Local) | 100% |
| **Total** | **$518/mo** | **$0/mo** | **100%** |

## Migration Strategies

### Why Client-First Works

1. **Gmail stores everything**: We're just a smart UI
2. **50GB IndexedDB**: More than enough for email
3. **Direct API access**: No middleman latency
4. **Browser does the work**: Infinite free compute
5. **No scaling issues**: Each user scales themselves

### Progressive Enhancement Path

1. **Start**: 100% client-side (free)
2. **Growth**: Add premium features server-side
3. **Enterprise**: Dedicated infrastructure
4. **Key**: Core email functions always free

### Security Advantages

1. **No honeypot**: Emails never on our servers
2. **User-controlled**: Local encryption keys
3. **Provider security**: Google/Microsoft level
4. **Compliance**: GDPR-compliant by design

---

**Note**: All technology choices are made considering the zero-cost constraint for up to 100 users. Each technology has a clear migration path when scaling beyond free tier limits.