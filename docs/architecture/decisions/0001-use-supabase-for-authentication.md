# ADR-0001: Use Supabase for Authentication

**Status**: Accepted  
**Date**: 2025-01-20  
**Author**: Development Team

## Context

The Finito Mail application needs a robust authentication system that supports OAuth providers (particularly Google for Gmail access) and can scale with our user base. Initially, we implemented a custom OAuth flow with manual token management, user creation, and session handling. This approach led to complexity, security concerns, and maintenance overhead.

We need an authentication solution that:
- Supports OAuth 2.0 with PKCE
- Handles token refresh automatically
- Provides user management out of the box
- Integrates well with our Next.js stack
- Is cost-effective for our target pricing model

## Decision

We will use Supabase Authentication for all user authentication needs. This includes:
- OAuth provider integration (starting with Google)
- Session management
- Token refresh handling
- User profile storage
- Row Level Security (RLS) for data access

We will remove the custom authentication implementation from the API app and migrate fully to Supabase's native OAuth flow.

## Consequences

### Positive
- Reduced complexity - no custom OAuth implementation to maintain
- Automatic token refresh handling
- Built-in security best practices (PKCE, secure session management)
- User management UI in Supabase Dashboard
- Cost-effective (free tier supports 50,000 MAU)
- Faster time to market
- Better security with less code

### Negative
- Vendor lock-in to Supabase
- Less control over authentication flow specifics
- Need to handle Supabase outages
- Migration effort for existing users (if any)

### Neutral
- Need to learn Supabase authentication patterns
- Documentation needs to be updated
- Testing approach changes to mock Supabase

## Alternatives Considered

### Option 1: Custom OAuth Implementation
We initially built this but found it error-prone and complex. Issues included:
- Manual token refresh logic
- Session management complexity
- Security vulnerabilities in token storage
- Maintenance overhead

### Option 2: NextAuth.js
A popular authentication library for Next.js, but:
- Still requires significant configuration
- Token refresh for OAuth providers can be tricky
- Would still need a database for user management

### Option 3: Auth0
A mature authentication platform, but:
- More expensive at scale
- Overkill for our simple OAuth needs
- Another external dependency

## Implementation Notes

1. Configure Google OAuth in Supabase Dashboard
2. Update environment variables to use Supabase credentials
3. Implement Supabase client in the web app
4. Update authentication flow to use Supabase's `signInWithOAuth`
5. Remove custom OAuth code from API app
6. Update all authenticated API routes to verify Supabase sessions

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Original issue discussion](#authentication-implementation)
- [Migration PR](#supabase-auth-migration)