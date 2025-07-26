# Architectural Decisions Summary

## Core Architecture: Hybrid (Like Inbox Zero)

Based on extensive research and analysis with Gemini, we're implementing the same hybrid architecture as Inbox Zero, with some optimizations:

### 1. Storage Strategy

**Decision: PostgreSQL for metadata, client-side for email bodies**
- Store email metadata server-side (headers, subjects, senders)
- Email bodies fetched on-demand from Gmail
- IndexedDB caches everything for performance
- Desktop app caches 3-6 months, web caches 30 days

**Rationale**: 
- Enables instant cross-device sync
- Avoids $4-6/user storage costs
- Provides consistent search experience
- Proven by Inbox Zero's success

### 2. Search Architecture

**Decision: Server-proxy pattern with client cache**
```typescript
// Hybrid search flow
async function search(query: string) {
  // 1. Search local cache first (instant)
  const localResults = await searchIndexedDB(query);
  displayResults(localResults, { provisional: true });
  
  // 2. Server proxies to Gmail API (complete)
  const serverResults = await serverApi.proxySearch(query);
  displayResults(serverResults, { final: true });
}
```

**Rationale**:
- Instant results from cache
- Complete results from Gmail
- No server-side index needed
- Consistent across devices

### 3. Email Sending

**Decision: Standard Gmail API messages.send**
- Use messages.send (100 quota units)
- Don't implement SES pattern (too complex)
- Plan for multi-project sharding later

**Rationale**:
- SES requires domain ownership (impossible for @gmail.com)
- Standard approach is reliable
- Sharding can be added when needed

### 4. Sync Strategy

**Decision: Modifier Queue + Push Notifications**
- Every action has modify() and persist() phases
- Offline actions queue in IndexedDB
- Gmail Push Notifications via Pub/Sub
- Exponential backoff for rate limits

**Rationale**:
- Instant UI response (<50ms)
- Handles offline seamlessly
- Proven by Superhuman
- Graceful rate limit handling

### 5. Infrastructure Evolution

**Phase 1 (Launch)**: Keep it simple
- PostgreSQL on Supabase/Neon ($20-50/month)
- Vercel for API ($20/month)
- Total: ~$0.10/user/month

**Phase 2 (Scale)**: Add optimizations
- Redis for time-based queries (snooze)
- Implement batch API operations
- Add multi-project sharding

**Phase 3 (Enterprise)**: Premium features
- Full email storage tier ($19.99+)
- AI features ($30+)
- SSO and audit logs

### 6. Desktop vs Web Strategy

**Desktop App**:
- Cache 3-6 months of email (configurable)
- Background sync without browser limits
- Native file system for queue persistence
- Same server APIs as web

**Web App**:
- Cache 30 days default
- Progressive sync in background
- Service Worker for offline
- Responsive design for mobile

## Security & Reliability Patterns

### OAuth Token Security
**Decision: Encrypted at rest with key management**
- MVP: Vercel encrypted environment variables
- Production: AWS KMS or GCP Secret Manager
- Never store plain text tokens in database
- Token rotation on each refresh

### Idempotency in Modifier Queue
**Decision: UUID per operation**
```typescript
interface ModifierOperation {
  id: string; // Unique UUID prevents duplicates
  type: 'archive' | 'delete' | 'snooze';
  emailId: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

### Historical Sync Resumption
**Decision: Checkpoint system in PostgreSQL**
```typescript
interface SyncCheckpoint {
  userId: string;
  folderId: string;
  lastHistoryId: string;
  processedCount: number;
  totalCount: number;
  lastProcessedDate: Date;
  failureCount: number;
}
```

## Key Implementation Priorities

### Immediate (MVP - Single Device)
1. PostgreSQL schema for metadata
2. Gmail API integration with batching
3. **OAuth token refresh mechanism**
4. **XSS protection with CSP headers**
5. **Circuit breaker for API resilience**
6. **Basic quota tracking**
7. Modifier queue for offline actions
8. Progressive sync with checkpoints

### Soon After Launch
1. **Memory management system**
2. **IndexedDB optimization**
3. **Data integrity validation**
4. Gmail Push Notifications
5. Server-proxy search
6. Redis for snooze features
7. Progressive sync optimization

### Future Enhancements
1. Multi-project sharding
2. Tiered storage (hot/cold)
3. AI features
4. Enterprise SSO

## Cost Projections

### User Profiles & Assumptions

**Average User (80% of users)**
- 50 emails received/day
- 5 searches/day (mostly local)
- 10 actions/day (archive, delete, etc.)
- 30-day active email set
- Initial sync: ~5,000 emails

**Power User (20% of users)**
- 500 emails received/day
- 50 searches/day (requiring server proxy)
- 100 actions/day
- 90-day active email set
- Initial sync: ~50,000 emails (20x burst cost)

**Initial Sync Cost**: One-time burst equivalent to 20x daily activity, spread over 24-48 hours

### Infrastructure Costs

| Users | Infrastructure | Per User | Monthly Total |
|-------|---------------|----------|---------------|
| 100   | PostgreSQL + Vercel | $0.30 | $30 |
| 1,000 | + Redis + CDN | $0.20 | $200 |
| 10,000 | + Dedicated DB | $0.15 | $1,500 |
| 100,000 | + Multi-region | $0.10 | $10,000 |

## Why This Architecture Wins

1. **Proven Pattern**: Inbox Zero validates this approach
2. **User Experience**: Fast, offline-capable, cross-device
3. **Cost Efficient**: 90% cheaper than full storage
4. **Privacy Friendly**: Emails stay with provider
5. **Scalable**: Can evolve with growth

## User Data Deletion

**Process for account deletion (GDPR/CCPA compliance)**:

1. **PostgreSQL**: Delete user record and all email metadata
2. **OAuth Revocation**: Call provider's revoke endpoint
3. **Token Deletion**: Remove from KMS/secret store
4. **Redis Cleanup**: Purge snooze data and caches
5. **Client Notification**: Send command to wipe IndexedDB
6. **Audit Log**: Record deletion timestamp and reason

```typescript
async function deleteUserAccount(userId: string) {
  // 1. Revoke OAuth tokens
  await revokeOAuthTokens(userId);
  
  // 2. Delete from all stores
  await Promise.all([
    db.user.delete(userId),
    db.emailMetadata.deleteMany({ userId }),
    redis.del(`user:${userId}:*`),
    kms.deleteSecret(`oauth:${userId}`)
  ]);
  
  // 3. Notify connected clients
  await broadcastToUser(userId, { 
    type: 'ACCOUNT_DELETED',
    action: 'WIPE_LOCAL_DATA' 
  });
  
  // 4. Audit log
  await auditLog.record({
    event: 'USER_DELETED',
    userId,
    timestamp: new Date()
  });
}
```

## Development Approach

"Start simple, evolve with demand"
- Launch with basic hybrid
- Add optimizations as we scale
- Let revenue justify complexity
- Focus on user experience first