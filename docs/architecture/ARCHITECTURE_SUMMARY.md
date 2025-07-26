# Finito Mail Architecture Summary

**Purpose**: High-level overview of the "what" and "why" - for product managers, new engineers, and quick understanding of the system.  
**For detailed implementation**: See [ARCHITECTURE.md](./ARCHITECTURE.md) which contains technical specs, schemas, and data flows.

## Current Architecture: Hybrid (PostgreSQL + Client Storage)

After extensive research and analysis, Finito Mail has adopted a **hybrid architecture** similar to Inbox Zero. This document summarizes our approach and ensures consistency across all documentation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTS                              │
├─────────────────────────────────────────────────────────┤
│ • Web (IndexedDB)                                       │
│ • Desktop (IndexedDB)                                   │
│ • Mobile (SQLite)                                       │
│                                                         │
│ Features:                                               │
│ - Email bodies cached locally                           │
│ - Instant search via MiniSearch                         │
│ - Offline-capable with sync queue                       │
└────────────────────────┬────────────────────────────────┘
                         │
                    API Calls
                         │
┌─────────────────────────────────────────────────────────┐
│                  BACKEND SERVICES                        │
├─────────────────────────────────────────────────────────┤
│ PostgreSQL          │ Redis              │ Vercel       │
│ • Email metadata    │ • Snooze queues    │ • Auth API   │
│ • Sync state        │ • Time-based ops   │ • Search proxy│
│ • User preferences  │ • Cache layer      │ • Webhooks   │
└─────────────────────┬───────────────────────────────────┘
                      │
                 Direct Access
                      │
┌─────────────────────────────────────────────────────────┐
│               EMAIL PROVIDERS                            │
├─────────────────────────────────────────────────────────┤
│ Gmail API                    │ Outlook API               │
│ • Bodies fetched on-demand   │ • Direct send             │
│ • Push notifications         │ • Incremental sync        │
└─────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Storage Strategy
- **PostgreSQL**: Email metadata only (50MB/user)
- **Client Storage**: Email bodies in IndexedDB
- **Redis**: Time-based features (snooze) and caching
- **Cost**: $0.10-0.30/user/month (vs $4-6 for full storage)

### 2. Sync Architecture
- **Modifier Queue Pattern**: Instant UI updates with background sync
- **Progressive Sync**: Inbox first → Recent → Historical
- **Push Notifications**: Real-time updates via Google Pub/Sub
- **Cross-Device**: Metadata sync enables seamless experience

### 3. Search Implementation
- **Hybrid Search**: Local results instantly, server proxy for completeness
- **No Elasticsearch**: Client-side MiniSearch + Gmail API proxy
- **Natural Language**: Optional Gemini integration for complex queries

### 4. Performance Optimizations
- **Field Filtering**: Reduce bandwidth by 90%
- **Batch Operations**: Max 50 requests per batch
- **Exponential Backoff**: Handle rate limits gracefully
- **Virtual Scrolling**: Render only visible emails

## Why Hybrid Over Pure Client-First?

### Original Approach (Pure Client-First)
- ✅ $0 infrastructure
- ✅ Perfect privacy
- ❌ No cross-device sync
- ❌ Limited search (local only)
- ❌ No time-based features

### Current Approach (Hybrid)
- ✅ Cross-device sync
- ✅ Complete search results
- ✅ Snooze and scheduling
- ✅ Still 95% cheaper than traditional
- ✅ Email bodies never on our servers

## Implementation Priorities

### Phase 1: Foundation (Weeks 1-4)
1. PostgreSQL schema for metadata
2. Gmail API with retry logic
3. Progressive sync implementation
4. Basic UI with virtual scrolling

### Phase 2: Core Features (Weeks 5-8)
1. Modifier Queue pattern
2. Hybrid search architecture
3. Push notifications setup
4. Snooze with Redis

### Phase 3: Polish (Weeks 9-12)
1. Performance optimizations
2. Cross-device sync
3. AI integration
4. Comprehensive testing

## Cost Analysis

| Users | Monthly Cost | Per User | vs Traditional |
|-------|--------------|----------|----------------|
| 100 | $30 | $0.30 | 97% cheaper |
| 1,000 | $200 | $0.20 | 98% cheaper |
| 10,000 | $1,500 | $0.15 | 98.5% cheaper |
| 100,000 | $10,000 | $0.10 | 99% cheaper |

## Documentation Status

### ✅ Updated to Hybrid Architecture
- ARCHITECTURE.md
- ARCHITECTURAL_DECISIONS.md
- API_DESIGN.md
- README.md
- ROADMAP.md (formerly IMPLEMENTATION_ROADMAP.md)

### ✅ New Documentation Created
- IMPLEMENTATION_PATTERNS.md
- SEARCH_ARCHITECTURE.md
- PUSH_NOTIFICATIONS.md
- SNOOZE_ARCHITECTURE.md

### 📁 Archived
- _archive/ROADMAP_client_first.md (original pure client approach)

## Key Patterns to Follow

1. **Always use exponential backoff** for API calls
2. **Batch operations** max 50 items
3. **Progressive sync** for fast initial load
4. **Modifier queue** for instant UI
5. **Field filtering** to save bandwidth

## Next Steps

Follow the ROADMAP.md for the 12-week implementation plan. Start with Phase 1 focusing on the foundation: PostgreSQL setup, Gmail API integration, and progressive sync.

---

This hybrid architecture provides the perfect balance: lightning-fast performance from local caching, cross-device sync from server coordination, and costs that are still 95%+ lower than traditional architectures.