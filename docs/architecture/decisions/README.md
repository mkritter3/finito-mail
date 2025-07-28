# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) - documents that capture important architectural decisions made during the development of Finito Mail.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences. Each ADR describes a single decision and is immutable once accepted.

## ADR Format

We use a lightweight format for our ADRs:

```markdown
# ADR-XXXX: Title

**Status**: [Proposed | Accepted | Deprecated | Superseded by ADR-YYYY]
**Date**: YYYY-MM-DD
**Author**: Name

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?

## Alternatives Considered
What other options were evaluated?
```

## Current ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-0001](./0001-use-supabase-for-authentication.md) | Use Supabase for Authentication | Accepted | 2025-01-20 |
| [ADR-0002](./0002-redis-pubsub-for-realtime.md) | Use Redis Pub/Sub for Real-time Updates | Accepted | 2025-01-23 |
| [ADR-0003](./0003-migrate-to-battle-tested-solutions.md) | Migrate to Battle-tested Solutions | Accepted | 2025-01-24 |
| [ADR-0004](./0004-client-first-architecture.md) | Client-first Architecture with IndexedDB | Accepted | 2024-11-01 |
| [ADR-0005](./0005-supabase-ssr-auth-migration.md) | Migration from localStorage to Supabase SSR Cookie-Based Authentication | Accepted | 2025-01-28 |

## Creating a New ADR

1. Copy the template from `adr-template.md`
2. Name it `XXXX-descriptive-name.md` (increment number)
3. Fill in all sections
4. Submit PR for review
5. Once accepted, the ADR becomes immutable

## Why ADRs?

- **Historical Context**: Understand why decisions were made
- **Onboarding**: New team members can understand the architecture
- **Avoid Revisiting**: Prevent rehashing the same discussions
- **Learning**: Learn from past decisions and their outcomes

## Guidelines

1. **One Decision Per ADR**: Keep ADRs focused on a single decision
2. **Context is Key**: Explain the problem thoroughly
3. **Consider Alternatives**: Document what else was considered
4. **Think Long-term**: Consider future implications
5. **Be Honest**: Document both positive and negative consequences

## Status Definitions

- **Proposed**: The ADR is under discussion
- **Accepted**: The decision has been agreed upon and implemented
- **Deprecated**: The decision is no longer relevant
- **Superseded**: Replaced by another ADR (link to the new one)