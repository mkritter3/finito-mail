# Authentication Modes for Development

## Overview

To simplify local development and avoid Supabase authentication issues, we support two authentication modes:

1. **Bypass Mode** (Recommended for development)
2. **Supabase Mode** (Production-like authentication)

## Configuration

Set the `NEXT_PUBLIC_AUTH_MODE` environment variable in your `.env.local`:

```bash
# For simple development auth (recommended)
NEXT_PUBLIC_AUTH_MODE=bypass

# For full Supabase auth (if you need to test auth flows)
NEXT_PUBLIC_AUTH_MODE=supabase
```

## Bypass Mode (Development)

When `NEXT_PUBLIC_AUTH_MODE=bypass`:

- Authentication is handled by a simple dev-only system
- No Supabase auth calls are made
- Login page shows pre-configured demo users
- Perfect for when Supabase auth is having issues

### Demo Users

| Email | Password | Role | User ID |
|-------|----------|------|---------|
| alice@demo.local | demo123456 | user | f10f54b3-b17e-4c13-bde6-894576d2bf60 |
| bob@demo.local | demo123456 | user | c8c3553c-1e9a-45de-b4f2-54801c816760 |
| charlie@demo.local | demo123456 | admin | edff8756-ff43-48e6-9cfa-117251578ecf |

### How It Works

1. User visits `/auth/dev` (automatically redirected when not authenticated)
2. Clicks on a demo user button
3. System sets a simple cookie (`dev-auth-user`)
4. Middleware checks this cookie for protected routes
5. API routes get user info from the dev auth system

## Supabase Mode (Production-like)

When `NEXT_PUBLIC_AUTH_MODE=supabase`:

- Full Supabase authentication is used
- Email/password and OAuth flows work normally
- Requires Supabase to be properly configured
- Same as production behavior

## Implementation Details

### Key Files

- `/apps/web/src/lib/auth/dev-auth.ts` - Dev auth utilities and user definitions
- `/apps/web/src/lib/auth/index.ts` - Unified auth helpers for both modes
- `/apps/web/src/utils/auth/middleware.ts` - Middleware with dev mode support
- `/apps/web/src/middleware.ts` - Main middleware entry point
- `/apps/web/src/app/auth/dev/page.tsx` - Dev login page
- `/apps/web/src/app/api/auth/dev-login/route.ts` - Dev login API
- `/apps/web/src/app/api/auth/me/route.ts` - Current user endpoint
- `/apps/web/src/app/api/auth/logout/route.ts` - Dev logout endpoint

### Protected Routes

The middleware protects:
- `/mail/*` - Email interface
- `/api/*` - API routes (except `/api/auth/*`)

### Session Management

In bypass mode:
- Sessions last 24 hours
- No JWT tokens
- Simple cookie-based auth
- User info stored in memory

## Switching Modes

To switch between modes:

1. Update `AUTH_MODE` in `.env.local`
2. Restart the Next.js dev server
3. Clear cookies if switching from bypass to supabase

## Troubleshooting

### Using the Unified Auth Helpers

```typescript
import { getCurrentUser, requireAuth } from '@/lib/auth'

// In server components
export default async function ProtectedPage() {
  const user = await getCurrentUser()
  // or
  const user = await requireAuth() // throws if not authenticated
  
  return <div>Welcome {user.name}</div>
}

// In API routes
export async function GET() {
  const user = await requireAuth()
  // Fetch user-specific data...
}
```

### "Email logins are disabled" Error

This typically means Supabase auth is misconfigured. Switch to bypass mode:

```bash
NEXT_PUBLIC_AUTH_MODE=bypass
```

### Can't Login in Bypass Mode

1. Check `NEXT_PUBLIC_AUTH_MODE=bypass` is set
2. Restart dev server
3. Clear browser cookies
4. Try again

### Need Real Auth Testing

Switch to Supabase mode and ensure:
1. Supabase is running (`npx supabase status`)
2. Database migrations are applied
3. Auth schema is properly configured

## Security Note

⚠️ **Bypass mode is for LOCAL DEVELOPMENT ONLY**

- Never use in production
- No real authentication
- No security checks
- Data is not protected

For staging/production, always use `NEXT_PUBLIC_AUTH_MODE=supabase` or remove the setting entirely.

## Production Safety

The bypass mode has multiple layers of protection:

1. **Double Environment Check**: Requires both `NODE_ENV=development` AND `NEXT_PUBLIC_AUTH_MODE=bypass`
2. **API Endpoint Protection**: `/api/auth/dev-login` returns 403 in production
3. **No Production Config**: The variable is only in `.env.local`, never in production
4. **Cookie Security**: Dev cookies use `secure: false` which won't work on HTTPS
5. **Middleware Safety**: Production mode completely ignores dev auth logic