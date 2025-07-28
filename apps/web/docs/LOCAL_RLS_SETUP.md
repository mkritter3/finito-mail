# Local RLS Development Setup

## Quick Start

Follow these steps to get RLS working locally:

### 1. Apply Schema Fix

Open [Supabase Studio](http://localhost:54323) → SQL Editor and run:

```sql
-- Create public.users table and sync triggers
-- Run the contents of: scripts/fix-local-schema.sql
```

### 2. Verify Fix

After running the SQL, check:

```sql
-- Should show 3 demo users
SELECT * FROM public.users WHERE email LIKE '%@demo.local';
```

### 3. Create Demo Emails

Now that the schema is fixed, create demo data:

```bash
npm run demo:create-users
```

### 4. Test Login

1. Go to http://localhost:3000/auth/dev
2. Click "Alice (User)" to quick login
3. You should now see emails in the inbox!

## Understanding the Fix

The fix creates:

1. **public.users table** - Stores user profile data
2. **Sync triggers** - Automatically copies auth.users → public.users
3. **Foreign key fix** - email_metadata now references public.users

This is the standard Supabase pattern for RLS with user data.

## Troubleshooting

### "Foreign key constraint" errors
- Make sure you ran the schema fix SQL first
- Check public.users has your demo users

### Empty inbox after login
- RLS policies might be too restrictive
- Check browser console for Supabase errors
- Try running: `npm run rls:verify-enabled`

### Can't create emails
- Verify user exists in both auth.users AND public.users
- Check foreign key constraints are correct

## Next Steps

Once working:
1. Test data isolation between users (Alice vs Bob)
2. Verify no data leaks
3. Start implementing UI features