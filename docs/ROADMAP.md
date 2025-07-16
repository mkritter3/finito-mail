# Finito Mail Implementation Roadmap

This document provides a realistic roadmap for implementing Finito Mail's hybrid architecture. Based on expert review, we've adjusted timelines to ensure quality and stability.

## Architecture Summary

Finito Mail uses a **hybrid architecture** matching Inbox Zero's approach:
- **PostgreSQL** for email metadata (headers, subjects, senders)
- **Client-side IndexedDB** for email bodies and performance
- **Redis** for time-based features (snooze) and caching
- **Minimal server** for auth, webhooks, and API proxying

### Key Differentiators
1. **Modifier Queue Pattern** - Instant UI updates with background sync
2. **Progressive Sync** - Emails available in seconds, not minutes
3. **Hybrid Search** - Local results instantly, server results for completeness
4. **Push Notifications** - Real-time updates without polling

## MVP Definition

**12-Week Goal**: A rock-solid, performant, single-device email client with core productivity features.

**Explicitly Deferred**: Cross-device sync, AI features, and advanced optimizations (moved to post-MVP roadmap).

## Implementation Phases

### 📅 Phase 1: Foundation & Sync (Weeks 1-5)

#### Weeks 1-2: Infrastructure & Gmail API + Security
```typescript
// Priority tasks
- [ ] Set up monorepo with Turborepo
- [ ] Configure PostgreSQL schema for metadata
- [ ] Implement OAuth2 PKCE flow with token encryption
- [ ] **OAuth token refresh mechanism (SecureTokenManager)**
- [ ] **XSS protection with CSP headers and DOMPurify**
- [ ] Create IndexedDB schema with Dexie.js
- [ ] Gmail API client with retry logic
- [ ] **Client-side rate limiting with Upstash Redis**
- [ ] Batch API operations (max 50/batch)
- [ ] Rate limiting with exponential backoff
- [ ] Field filtering for bandwidth optimization
```

**Key Deliverables:**
- Working auth flow with automatic token refresh
- XSS protection and security headers in place
- Gmail API integration with proper error handling
- Basic database schemas ready

#### Weeks 3-4: Progressive Sync + Resilience (CRITICAL PATH)
```typescript
// This is the most complex component - allocate 2 full weeks
- [ ] Web Worker for background sync
- [ ] Progressive sync strategy implementation
- [ ] **Circuit breaker pattern for Gmail API calls**
- [ ] **Basic quota tracking (250 units/user/second)**
- [ ] Sync checkpoint system in PostgreSQL
- [ ] Graceful resumption of failed syncs
- [ ] History API integration with gap handling
- [ ] Sync progress UI/UX
- [ ] Comprehensive sync error handling
- [ ] Testing with various mailbox sizes
```

**Success Criteria:**
- Can sync 50k+ emails without failure
- Circuit breaker prevents cascading failures
- Quota tracking prevents hitting limits
- Resumes correctly after interruption
- Handles Gmail history gaps gracefully
- Progress is visible and accurate

#### Week 5: Basic UI & Local Search
```typescript
// MVP UI implementation
- [ ] Email list with virtual scrolling
- [ ] Email viewer with split pane
- [ ] Compose dialog (basic)
- [ ] MiniSearch.js integration
- [ ] Search indexing in Web Worker
- [ ] Responsive design basics
```

### 📅 Phase 2: Core Features (Weeks 6-10)

#### Weeks 6-7: Modifier Queue + Performance (CRITICAL PATH)
```typescript
// The heart of reliability - allocate 2 full weeks
- [ ] Modifier interface and base class
- [ ] **Memory management system (MemoryManager)**
- [ ] Idempotency with unique operation IDs
- [ ] Common modifiers (archive, delete, mark read, star)
- [ ] Offline queue persistence in IndexedDB
- [ ] Queue processing with retry logic
- [ ] Error recovery and rollback mechanisms
- [ ] Conflict resolution strategy
- [ ] Comprehensive testing of offline scenarios
```

**Success Criteria:**
- Actions feel instant (<50ms)
- Memory pressure handled gracefully
- Works perfectly offline
- Syncs reliably when back online
- No duplicate operations

#### Week 8: Snooze Feature + Data Optimization
```typescript
// Time-based email management + performance
- [ ] Redis sorted sets setup
- [ ] **IndexedDB optimization (DatabaseOptimizer)**
- [ ] Snooze API endpoints
- [ ] Snooze UI with preset options
- [ ] Wake-up cron service (Cloudflare)
- [ ] Snooze view in UI
- [ ] Integration with modifier queue
- [ ] **Archive emails >90 days automatically**
```

#### Weeks 9-10: Push Notifications & Search + Integrity
```typescript
// Real-time updates and complete search - 2 weeks
- [ ] Google Cloud Pub/Sub setup
- [ ] Gmail watch request implementation
- [ ] **Data integrity validation (DataIntegrityValidator)**
- [ ] Cloudflare webhook handler
- [ ] WebSocket connection management
- [ ] Fallback polling strategy
- [ ] Server search proxy endpoint
- [ ] Search result merging (local + server)
- [ ] Search UI improvements
```

**Success Criteria:**
- Email changes appear within seconds
- Data consistency validated regularly
- Search returns complete results
- Graceful degradation if push fails

### 📅 Phase 3: Stabilization & Launch (Weeks 11-12)

#### Week 11: Integration & Testing
```typescript
// Comprehensive testing across all features
- [ ] Integration test suite
- [ ] E2E test scenarios
- [ ] Performance profiling
- [ ] Memory leak detection
- [ ] Error tracking setup (Sentry)
- [ ] Analytics implementation
- [ ] Load testing core flows
```

#### Week 12: Polish & Launch Prep
```typescript
// Final polish and launch preparation
- [ ] Bug fixes from testing
- [ ] Performance optimizations
- [ ] Documentation updates
- [ ] Deployment scripts
- [ ] Monitoring setup
- [ ] Beta user onboarding
- [ ] Launch checklist completion
```

## Post-MVP Roadmap (Weeks 13+)

### Phase 4: Cross-Device Sync
- Device registry system
- Sync conflict resolution (CRDT or LWW)
- Selective sync preferences
- Cross-device notifications

### Phase 5: AI Features
- Gemini Flash integration
- Smart compose
- Email summarization
- Natural language search

### Phase 6: Advanced Optimizations
- Tiered storage implementation
- Predictive prefetching
- Advanced caching strategies
- Compression for old emails

## Technical Implementation Guide

### Critical Code Patterns

**Always Use These Patterns:**

1. **Retry with Backoff:**
```typescript
await retryWithBackoff(async () => {
  return await gmail.users.messages.get({ 
    userId: 'me', 
    id: messageId 
  });
});
```

2. **Idempotent Operations:**
```typescript
interface ModifierOperation {
  id: string; // Unique UUID per operation
  type: 'archive' | 'delete' | 'snooze';
  emailId: string;
  timestamp: number;
}
```

3. **Sync Checkpoints:**
```typescript
interface SyncCheckpoint {
  userId: string;
  folderId: string;
  lastHistoryId: string;
  processedCount: number;
  totalCount: number;
  lastProcessedDate: Date;
}
```

## Risk Mitigation

### Technical Risks
| Risk | Mitigation | Owner |
|------|------------|-------|
| Sync complexity | 2 weeks allocated, checkpoint system | Week 3-4 |
| Modifier queue reliability | 2 weeks allocated, idempotency | Week 6-7 |
| Push notification setup | Fallback polling, 2 weeks allocated | Week 9-10 |
| Gmail API limits | Exponential backoff, batch operations | Ongoing |

### Schedule Risks
| Risk | Mitigation |
|------|------------|
| Feature creep | Strict MVP scope, defer nice-to-haves |
| Integration issues | Continuous testing from Week 1 |
| Performance problems | Profile early and often |
| Hidden complexity | Buffer time in Weeks 11-12 |

## Success Metrics

### Week 12 Launch Criteria
- [ ] Can sync 10k+ emails reliably
- [ ] All core actions < 50ms response time
- [ ] Works offline for all operations
- [ ] Search returns results < 500ms
- [ ] Zero data loss in testing
- [ ] <0.1% error rate in beta

### Performance Targets
| Operation | Target | Max Acceptable |
|-----------|--------|----------------|
| Email list load | <100ms | 300ms |
| Email open | <50ms | 150ms |
| Search (local) | <10ms | 50ms |
| Archive action | <50ms | 200ms |
| Initial sync (1k emails) | <30s | 60s |

## Cost Projections

| Users | Monthly Cost | Per User |
|-------|--------------|----------|
| 100 | $30 | $0.30 |
| 1,000 | $200 | $0.20 |
| 10,000 | $1,500 | $0.15 |

## Key Decisions Log

1. **Single-device MVP**: Focus on stability over features
2. **PostgreSQL over SQLite**: Better for future scaling
3. **Defer AI**: Get core email right first
4. **2 weeks for sync**: Most critical component
5. **2 weeks for modifiers**: Reliability is paramount

---

This roadmap prioritizes stability and core functionality. By deferring complex features like cross-device sync and AI to post-MVP, we increase the probability of launching a solid product on schedule.