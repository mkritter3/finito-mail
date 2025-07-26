# 🏗️ Architecture Documentation

This section contains comprehensive documentation about Finito Mail's system architecture, design decisions, and technical implementation details.

## 📚 Core Architecture Documents

### System Design
- **[Architecture Overview](./ARCHITECTURE.md)** - Complete system design, component relationships, and data flow
- **[Architecture Summary](./ARCHITECTURE_SUMMARY.md)** - High-level architecture overview for quick understanding
- **[Tech Stack](./TECH_STACK.md)** - Technology choices with detailed rationale

### Design Decisions
- **[Architectural Decisions](./ARCHITECTURAL_DECISIONS.md)** - Key decisions and rationale for hybrid approach
- **[Architecture Evolution](./ARCHITECTURE_EVOLUTION.md)** - Visual journey of our architectural transformation
- **[Data Strategy](./DATA_STRATEGY.md)** - Data durability, backup, and sync strategies

### Feature Architecture
- **[Search Architecture](./SEARCH_ARCHITECTURE.md)** - Hybrid search with local cache and server proxy
- **[Snooze Architecture](./SNOOZE_ARCHITECTURE.md)** - Redis sorted sets for time-based features

## 🎯 Key Architectural Principles

### 1. **Hybrid Client-First Design**
- 99% of operations happen client-side for blazing-fast performance
- Direct Gmail API access with per-user quotas
- Local IndexedDB storage with 50GB+ capacity
- Server-side only for security and infrastructure

### 2. **Performance First**
- Sub-50ms response times through local caching
- Background sync for non-blocking operations
- Optimistic UI updates with eventual consistency
- Intelligent prefetching and lazy loading

### 3. **Security by Design**
- Email bodies never touch our servers
- OAuth 2.0 PKCE for secure authentication
- Nonce-based CSP with strict-dynamic
- Client-side encryption for sensitive data

### 4. **Scalability & Cost Efficiency**
- $0.10-0.30/user infrastructure cost
- No database required (client-first)
- Minimal server footprint
- Edge-first deployment strategy

## 🔄 Architecture Overview

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
│  Supabase   │    Upstash      │    Production              │
│   (Auth)    │  (Rate Limit)   │   Infrastructure           │
└─────────────┴─────────────────┴─────────────────────────────┘
```

## 📊 Architecture Evolution Timeline

1. **Phase 0**: Documentation & Setup
2. **Phase 1**: Custom implementation with production hardening
3. **Phase 2**: Migration to managed services (Current)
4. **Phase 3**: Scale optimization
5. **Phase 4**: Enterprise features
6. **Phase 5**: Global distribution

See [Architecture Evolution](./ARCHITECTURE_EVOLUTION.md) for detailed progression.

## 🔍 Deep Dives

### Understanding the Hybrid Approach
Our hybrid architecture combines the best of both worlds:
- **Client-side**: Performance, privacy, offline capability
- **Server-side**: Security, coordination, shared state

### Key Components

1. **Client Layer**
   - Direct Gmail API integration
   - IndexedDB for local storage
   - Service workers for offline support
   - Optimistic UI updates

2. **Server Layer**
   - Authentication coordination
   - Rate limiting and security
   - Webhook processing
   - Health monitoring

3. **Infrastructure Layer**
   - CDN for static assets
   - Edge workers for low latency
   - Monitoring and observability
   - Auto-scaling capabilities

## 🚀 Implementation Guidelines

When working with our architecture:

1. **Prefer client-side processing** unless security requires server-side
2. **Use IndexedDB** for all email storage and caching
3. **Implement offline-first** patterns for all features
4. **Minimize server calls** to reduce latency and cost
5. **Follow security patterns** for any server-side code

## 📈 Performance Targets

- Email list render: <50ms
- Search results: <100ms
- Send email: <200ms
- Sync completion: <5s
- Offline to online: Instant

## 🔗 Related Documentation

- [Implementation Patterns](../development/IMPLEMENTATION_PATTERNS.md)
- [Performance Guide](../development/PERFORMANCE.md)
- [Security Patterns](../development/SECURITY_PATTERNS.md)
- [API Design](../api/API_DESIGN.md)

## 🎓 Learning Path

1. Start with [Architecture Summary](./ARCHITECTURE_SUMMARY.md) for overview
2. Read [Architectural Decisions](./ARCHITECTURAL_DECISIONS.md) to understand "why"
3. Study [Architecture](./ARCHITECTURE.md) for complete details
4. Review specific architectures ([Search](./SEARCH_ARCHITECTURE.md), [Snooze](./SNOOZE_ARCHITECTURE.md)) as needed

---

**Remember**: Our architecture prioritizes user experience through client-first design while maintaining enterprise-grade security and reliability.