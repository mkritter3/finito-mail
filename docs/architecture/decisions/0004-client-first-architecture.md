# ADR-0004: Client-first Architecture with IndexedDB

**Status**: Accepted  
**Date**: 2024-11-01  
**Author**: Development Team

## Context

Traditional email clients follow a server-centric architecture where emails are stored on servers and fetched on-demand. This approach has several limitations:
- Network latency for every operation (100-200ms)
- Server infrastructure costs scale linearly with users
- Privacy concerns with storing emails on servers
- Poor offline experience
- Complex caching strategies

Modern browsers now support IndexedDB with 50GB+ storage capacity, and devices have powerful processors capable of handling email operations locally. This opens up the possibility of a radically different architecture.

## Decision

We will implement a client-first architecture where:
- All emails are stored locally in IndexedDB
- Email processing happens entirely in the browser
- Server only handles authentication and minimal metadata
- Direct API access to email providers from the client
- Web Workers for background processing

Architecture:
```
Client (99% of operations) → IndexedDB → Direct Gmail API
                          ↓ (metadata only)
                     Minimal Backend (Redis + Auth)
```

## Consequences

### Positive
- Sub-50ms response times for all operations
- True offline functionality
- Extreme cost efficiency ($0.035/user/month)
- Complete privacy (emails never touch our servers)
- No server-side email storage needed
- Scales infinitely (each client has own storage)
- Works identically across web/desktop/mobile

### Negative
- Large initial sync time for new users
- Browser storage limitations (50GB)
- More complex client-side code
- Harder to implement some features (cross-device sync)
- SEO challenges (client-rendered)
- Can't access emails from any device instantly

### Neutral
- Different development paradigm
- Need excellent error handling on client
- Progressive enhancement important
- Browser compatibility considerations

## Alternatives Considered

### Option 1: Traditional Server-centric
Store all emails on server:
- High infrastructure costs ($4-6/user)
- Network latency on every operation
- Privacy concerns
- Proven approach

### Option 2: Hybrid with Server Cache
Cache recent emails on server:
- Moderate costs ($1-2/user)
- Complex cache invalidation
- Still has privacy concerns
- Middle-ground approach

### Option 3: Edge Computing
Process at edge locations:
- Better latency than central server
- Still significant costs
- Complex deployment
- Limited by edge capabilities

## Implementation Notes

Key technical decisions:
1. Use Dexie.js for IndexedDB abstraction
2. Web Workers for sync and search
3. Virtual scrolling for performance
4. Progressive sync (recent first)
5. Optimistic UI updates
6. Background sync with exponential backoff

Critical success factors:
- Excellent onboarding experience during initial sync
- Robust error handling and recovery
- Clear storage usage indicators
- Efficient data structures

This architecture is fundamental to achieving our goals of performance, privacy, and cost-efficiency. It's a bold bet on client capabilities that differentiates us from competitors.

## References

- [Original Architecture Document](../ARCHITECTURE.md)
- [Performance Requirements](../PERFORMANCE.md)
- [Business Model Analysis](../BUSINESS_OVERVIEW.md)