# Finito Mail - Project Documentation

## Overview

This is the single source of truth for the Finito Mail project - a blazing-fast, premium email client inspired by Superhuman, supporting web, desktop, and mobile platforms with true frontend/backend separation.

### Vision
Build an email client that beats Superhuman's performance through revolutionary client-first architecture - delivering <50ms response times at $9.99/month with 99% gross margins.

### Core Principles
- **Client-First Architecture**: 99% of operations in the browser (no server costs)
- **Performance First**: <50ms interactions (no network latency)
- **True Privacy**: Emails never touch our servers
- **Infinite Scalability**: Each user is their own database
- **99% Gross Margins**: $0.035/user infrastructure cost
- **Works Offline**: Full functionality without internet

## Documentation Structure

All documentation is **immutable** - these files represent permanent architectural decisions and will not change. They serve as the definitive reference for all development.

### Core Documentation

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design, component relationships, and data flow
2. **[TECH_STACK.md](./TECH_STACK.md)** - Technology choices with detailed rationale
3. **[BUSINESS_OVERVIEW.md](./BUSINESS_OVERVIEW.md)** - Product requirements and feature specifications
4. **[FEATURES.md](./FEATURES.md)** - Comprehensive feature documentation with all email functionality
5. **[SECURITY.md](./SECURITY.md)** - Security architecture, encryption, and authentication
6. **[API_DESIGN.md](./API_DESIGN.md)** - Minimal REST API contracts (auth & webhooks only)
7. **[PLATFORM_GUIDE.md](./PLATFORM_GUIDE.md)** - Platform-specific implementation details
8. **[PERFORMANCE.md](./PERFORMANCE.md)** - Performance targets and optimization strategies
9. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Infrastructure setup and deployment procedures
10. **[ROADMAP.md](./ROADMAP.md)** - Detailed implementation phases with metrics
11. **[UI_DESIGN.md](./UI_DESIGN.md)** - Complete UI/UX design system and layout specifications
12. **[KEYBOARD_SHORTCUTS.md](./KEYBOARD_SHORTCUTS.md)** - Comprehensive keyboard shortcut reference
13. **[DATA_STRATEGY.md](./DATA_STRATEGY.md)** - Data durability, backup, and sync strategies

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- Modern browser (50GB+ IndexedDB support)
- Accounts: Vercel (auth only), Upstash (free tier), Cloudflare (free tier)

### Initial Setup
```bash
# Clone the repository
git clone [repository-url]
cd finito-mail

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your service credentials

# Start development
pnpm dev
```

## Project Status

Current Phase: **Phase 0 - Documentation & Setup**

See [ROADMAP.md](./ROADMAP.md) for detailed progress tracking.

## Key Metrics

### Performance Targets
- Email list render: <50ms
- Search results: <100ms
- Send email: <200ms
- Platform sync: <5s

### Success Criteria
1. Performance: All interactions under 100ms
2. Business: Sustainable unit economics at scale
3. Features: 95% Superhuman feature parity
4. Platforms: Native apps for all major platforms
5. Security: End-to-end encryption available
6. Reliability: 99.9% uptime with offline support

## Client-First Architecture

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

99% of operations happen client-side = $0.035/user/month infrastructure cost!
```

## Development Workflow

1. All changes must align with documentation
2. Follow the phases defined in [ROADMAP.md](./ROADMAP.md)
3. No phase begins until the previous phase meets exit criteria
4. Performance testing required for all changes
5. Security review for any authentication/encryption changes

## Internal Development

This is a closed-source commercial project. Access to the codebase is restricted to authorized team members only.

---

**Remember**: This documentation is the single source of truth. All architectural decisions and implementation details must trace back to these documents.