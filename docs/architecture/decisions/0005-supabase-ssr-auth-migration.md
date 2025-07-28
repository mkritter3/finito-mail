# ADR-0005: Migration from localStorage to Supabase SSR Cookie-Based Authentication

Date: 2025-01-28
Status: Implemented

## Context

The application initially used localStorage to store authentication tokens, which presented several security and architectural limitations:

1. **Security vulnerabilities**: Tokens in localStorage are accessible to any JavaScript code, making them vulnerable to XSS attacks
2. **Server-side limitations**: Cannot perform authentication checks during SSR, limiting the use of server components
3. **Session synchronization**: Difficult to keep client and server sessions in sync
4. **Token refresh complexity**: Manual token refresh logic required in multiple places

## Decision

We migrated to Supabase's SSR authentication system using HTTP-only cookies for session management. This architecture provides:

1. **Enhanced security**: HTTP-only cookies are not accessible to JavaScript, preventing XSS token theft
2. **Server-side authentication**: Full access to user session during SSR for protected routes
3. **Automatic session management**: Supabase handles token refresh and session synchronization
4. **Better Next.js integration**: Leverages App Router's server components and server actions

## Implementation Details

### 1. Core Authentication Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│  Middleware  │────▶│   Server    │
│             │     │              │     │ Component   │
│  HTTP-only  │     │   Updates    │     │             │
│   Cookie    │◀────│   Cookie     │     │  Validates  │
└─────────────┘     └──────────────┘     │   Session   │
                                          └─────────────┘
```

### 2. Key Components

#### Middleware (`/src/middleware.ts`)
- Intercepts all requests to update session cookies
- Ensures server always has fresh authentication state
- Handles token refresh transparently

#### AuthProvider (`/src/components/auth/auth-provider.tsx`)
- Client-side context for auth state
- Listens to auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
- **Critical**: Calls `router.refresh()` on TOKEN_REFRESHED to sync server session

#### Server Components
- Protected layouts check authentication server-side
- No need for client-side auth guards
- Direct database access with user context

#### Server Actions
- Secure mutations with automatic auth validation
- No token passing required
- RLS policies enforce data access

### 3. Migration Steps Performed

1. **Created Supabase utilities**:
   - `/lib/supabase/server.ts` - Server-side client with cookie handling
   - `/lib/supabase/client.ts` - Browser-safe client

2. **Implemented middleware**:
   - Automatic session refresh on every request
   - Cookie updates for token rotation

3. **Refactored authentication flow**:
   - Removed all localStorage usage
   - Updated auth hooks to use context
   - Converted protected routes to server components

4. **Updated data fetching**:
   - Bulk actions now use server actions
   - Optimistic updates with `useOptimistic`
   - Pending states with `useTransition`

5. **E2E test updates**:
   - Removed E2E_TESTING flags from code
   - Implemented cookie mocking in Playwright

## Consequences

### Positive

1. **Security**: Tokens are no longer accessible to client-side JavaScript
2. **Performance**: Server components can fetch data during SSR
3. **Simplicity**: No manual token management or refresh logic
4. **Reliability**: Automatic session synchronization between client and server
5. **Type safety**: Full TypeScript support with server/client separation

### Negative

1. **Client components**: Must use AuthProvider context instead of direct auth checks
2. **Testing complexity**: E2E tests require cookie mocking
3. **Migration effort**: Significant refactoring of existing components

### Trade-offs

1. **Server dependency**: All auth checks now require server round-trips
2. **Cookie limitations**: Subject to browser cookie policies and size limits
3. **Debugging**: Auth state less visible in browser DevTools

## Security Considerations

1. **HTTP-only cookies**: Prevent XSS attacks from stealing tokens
2. **Secure flag**: Cookies only sent over HTTPS in production
3. **SameSite**: Protects against CSRF attacks
4. **Automatic expiry**: Cookies expire with session timeout
5. **RLS policies**: Database-level security for data access

## Testing Strategy

1. **Unit tests**: Mock Supabase client for component testing
2. **Integration tests**: Test server actions with test database
3. **E2E tests**: Use Playwright with cookie injection for auth flows

## Monitoring

1. **Auth events**: Track login/logout/refresh events
2. **Session errors**: Monitor middleware cookie update failures
3. **Token refresh**: Log TOKEN_REFRESHED frequency for optimization

## Future Considerations

1. **Session persistence**: Consider implementing "remember me" functionality
2. **Multi-device**: Add device management and session listing
3. **Security headers**: Implement CSP and other security headers
4. **Rate limiting**: Add auth attempt rate limiting

## References

- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side-rendering)
- [Next.js App Router Auth Patterns](https://nextjs.org/docs/app/building-your-application/authentication)
- [OWASP Session Management](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/README)