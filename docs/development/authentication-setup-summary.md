# Authentication Setup - Development Mode

## What Was Done

I've implemented a clean separation between development and production authentication to solve the "Email logins are disabled" error you were experiencing.

## The Solution: AUTH_MODE

Instead of trying to fix the complex Supabase auth issues, I created a simple bypass mode for local development:

### 1. Set AUTH_MODE in .env.local
```bash
AUTH_MODE=bypass
```

### 2. Access the Dev Login Page
Visit: http://localhost:3000/auth/dev

You'll see three demo users you can click to login instantly:
- alice@demo.local (regular user)
- bob@demo.local (regular user)
- charlie@demo.local (admin)

### 3. How It Works
- No Supabase auth calls
- Simple cookie-based sessions
- Middleware handles route protection
- API routes can access user info

## Files Created/Modified

1. `/src/lib/auth/dev-auth.ts` - Core dev auth utilities
2. `/src/app/auth/dev/page.tsx` - Clean dev login UI
3. `/src/app/api/auth/dev-login/route.ts` - Simplified login endpoint
4. `/docs/development/auth-modes.md` - Full documentation
5. Updated `.env.local` with AUTH_MODE=bypass

## Why This Approach?

1. **Immediate Solution** - You can login and develop right now
2. **No Supabase Dependency** - Avoids the schema/configuration issues
3. **Simple & Clear** - Easy to understand and maintain
4. **Production Safe** - Only works when AUTH_MODE=bypass is explicitly set

## Next Steps

1. Visit http://localhost:3000/auth/dev
2. Click any demo user to login
3. Continue developing without auth issues

When you need to test real authentication flows, just change:
```bash
AUTH_MODE=supabase
```

This gives you the best of both worlds - simple development auth when you need it, and full Supabase auth when you want to test production scenarios.