# ADR-0002: Use Redis Pub/Sub for Real-time Updates

**Status**: Accepted  
**Date**: 2025-01-23  
**Author**: Development Team

## Context

Finito Mail requires real-time synchronization between Gmail and the client application. When emails arrive, are read, or are modified in Gmail, these changes need to be reflected immediately in the user's browser without requiring a manual refresh.

Initially, we implemented an in-memory connection map for Server-Sent Events (SSE). However, this approach fails in serverless environments where:
- Instances are ephemeral
- No shared memory between instances
- Horizontal scaling breaks the connection map
- Railway and Vercel don't support long-lived connections well

We need a distributed solution that works across multiple server instances and survives instance recycling.

## Decision

We will use Redis Pub/Sub as the message broker for real-time updates with the following architecture:

```
Gmail → Google Pub/Sub → Webhook → Redis Pub/Sub → SSE → Client
```

Each SSE connection subscribes to a user-specific Redis channel, and the webhook publishes updates to these channels. This creates a distributed, scalable real-time system.

## Consequences

### Positive
- Works in serverless/distributed environments
- Scales horizontally without code changes
- Survives instance recycling
- Decouples webhook processing from client connections
- Standard Redis operations (well-documented)
- Enables future features (presence, collaboration)

### Negative
- Requires Redis instance that supports Pub/Sub (not Upstash)
- Additional infrastructure dependency
- Slightly higher latency (Redis hop)
- More complex local development setup
- Additional cost (~$10-25/month for Redis)

### Neutral
- Need to handle Redis connection failures
- Monitoring becomes more important
- Team needs to understand Redis Pub/Sub patterns

## Alternatives Considered

### Option 1: In-memory Connection Map
Original implementation that failed because:
- Doesn't work in serverless
- Breaks with multiple instances
- Lost connections on deploy

### Option 2: Database Polling
Each client polls for updates:
- High database load
- Increased latency (polling interval)
- Not truly real-time

### Option 3: Supabase Realtime
Considered but decided against initially because:
- Less control over message format
- Would require significant refactoring
- Planned for Phase 3 migration

### Option 4: WebSockets with Sticky Sessions
- Requires WebSocket support (not available on Railway)
- Complex load balancer configuration
- Still has instance affinity issues

## Implementation Notes

1. Set up Redis instance (not Upstash - must support Pub/Sub)
2. Create Redis client factory with connection pooling
3. Modify webhook to publish to Redis channels
4. Update SSE endpoint to subscribe to Redis
5. Add connection cleanup on client disconnect
6. Implement heartbeat for connection health
7. Add Redis connection monitoring

Migration path to Supabase Realtime (Phase 3):
- Keep same event structure
- Gradual migration with feature flags
- Parallel running during transition

## References

- [Redis Pub/Sub Documentation](https://redis.io/docs/manual/pubsub/)
- [Original Issue: Real-time Sync in Serverless](#realtime-serverless)
- [Implementation PR](#redis-pubsub-implementation)
- [Phase 3 Roadmap](../../roadmap/INFRASTRUCTURE_ROADMAP.md)