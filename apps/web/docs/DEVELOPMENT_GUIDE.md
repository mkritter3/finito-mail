# Development Guide

**Current Status**: Active development using local environment only.

## 🎯 Development Philosophy

1. **Local First**: All development happens on local Supabase
2. **Schema Parity**: Local schema matches production patterns
3. **RLS by Default**: Security is built-in from the start
4. **Incremental Progress**: Implement features one vertical slice at a time

## 🚀 Getting Started

### First Time Setup

```bash
# 1. Clone and install
cd apps/web
npm install

# 2. Start Supabase
npx supabase start

# 3. Apply RLS and schema fixes
npm run fix:local-schema
# Open http://localhost:54323 → SQL Editor
# Run the contents of scripts/fix-local-schema.sql

# 4. Create demo data
npm run demo:create-users

# 5. Start development
npm run dev
```

### Daily Development

```bash
# 1. Ensure Supabase is running
npx supabase status

# 2. Start dev server
npm run dev

# 3. Sign in at http://localhost:3000/auth/dev
```

## 🔐 Working with RLS

### Key Concepts

1. **Every query respects RLS** - No data leaks possible
2. **auth.uid() is your friend** - This identifies the current user
3. **public.users is required** - Links auth to your data

### Common Patterns

#### Server Component Data Fetching
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function InboxPage() {
  const supabase = await createClient()
  
  // This automatically filters to current user's emails
  const { data: emails } = await supabase
    .from('email_metadata')
    .select('*')
    .order('received_at', { ascending: false })
    
  return <EmailList emails={emails || []} />
}
```

#### Client Component Data Fetching
```typescript
import { createClient } from '@/lib/supabase/client'

function useEmails() {
  const supabase = createClient()
  
  // Queries are automatically scoped to authenticated user
  const fetchEmails = async () => {
    const { data } = await supabase
      .from('email_metadata')
      .select('*')
    return data
  }
}
```

## 🧪 Testing Your Implementation

### Manual Testing
1. Sign in as Alice: See Alice's data only
2. Sign out and sign in as Bob: See Bob's data only
3. Check browser console for any RLS errors

### Automated Verification
```bash
# Check RLS is enabled
npm run rls:verify-enabled

# Run comprehensive tests
npm run rls:phase2:verify
```

## 📝 Current Development Tasks

### Vertical Slice 1: Inbox View ✅
- [x] Enable RLS
- [x] Fix authentication
- [ ] Get inbox displaying emails
- [ ] Implement email actions (read/unread)

### Vertical Slice 2: Email Rules
- [ ] Display user's rules
- [ ] Create new rules
- [ ] Edit/delete rules

### Vertical Slice 3: Gmail Integration
- [ ] OAuth flow with RLS
- [ ] Sync emails for current user
- [ ] Handle Gmail webhooks

## 🚧 Known Issues

1. **Email creation fails** - Apply schema fix first
2. **Empty inbox** - Check RLS policies and user data
3. **Auth redirects** - Ensure middleware is configured

## 🛠️ Helpful Commands

```bash
# Check what's in the database
psql postgresql://postgres:postgres@localhost:54322/postgres

# View Supabase logs
npx supabase logs

# Reset everything
npx supabase db reset
npm run demo:setup
```

## 📚 Resources

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js App Router](https://nextjs.org/docs/app)
- [@supabase/ssr Documentation](https://supabase.com/docs/guides/auth/server-side/nextjs)

---

Remember: We're in active development. Focus on getting things working locally before worrying about staging or production.