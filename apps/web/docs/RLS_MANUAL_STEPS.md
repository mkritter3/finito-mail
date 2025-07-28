# RLS Manual Testing Steps

## Quick Reference for Manual SQL Execution

### Step 1: Get User IDs

```sql
-- Run this first to see existing users
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10;
```

### Step 2: Create Test Users (if needed)

Option A: In Supabase Dashboard
1. Go to Authentication > Users
2. Click "Add user"
3. Create two test users:
   - Email: `rls-test-a@example.com`
   - Email: `rls-test-b@example.com`

Option B: Enable signups temporarily
1. Go to Authentication > Providers
2. Enable email signups
3. Run `npm run test:rls:setup:simple`
4. Disable email signups again

### Step 3: Run Test Data SQL

1. Copy the user IDs from Step 1
2. Open `scripts/rls-test-data.sql`
3. Replace:
   - `REPLACE_WITH_USER_A_ID` with first user's ID
   - `REPLACE_WITH_USER_B_ID` with second user's ID
4. Run the entire SQL in Supabase SQL Editor

### Step 4: Verify RLS Policies

Run these queries to test RLS:

```sql
-- Test 1: Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('email_metadata', 'email_rules_v2')
ORDER BY tablename;

-- Test 2: Impersonate User A
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = json_build_object(
  'sub', 'YOUR_USER_A_ID_HERE',
  'role', 'authenticated'
)::text;

-- Should see only User A's data
SELECT COUNT(*) as "User A emails" FROM email_metadata;
SELECT COUNT(*) as "User A rules" FROM email_rules_v2;

-- Should see 0 emails from User B
SELECT COUNT(*) as "User A seeing User B emails (should be 0)" 
FROM email_metadata 
WHERE user_id = 'YOUR_USER_B_ID_HERE'::uuid;

RESET ROLE;

-- Test 3: Test anonymous access (should see nothing)
SET LOCAL ROLE anon;
SELECT COUNT(*) as "Anonymous emails (should be 0)" FROM email_metadata;
SELECT COUNT(*) as "Anonymous rules (should be 0)" FROM email_rules_v2;
RESET ROLE;
```

### Step 5: Run Automated Tests

Once test data exists:

```bash
# Run the automated verification suite
npm run rls:phase2:verify

# Check results
cat scripts/rls-phase2-verification-results.json
```

## Expected Results

✅ **Good Results**:
- User A sees only their emails (3)
- User B sees only their emails (3)
- Users cannot see each other's data (0)
- Anonymous users see nothing (0)
- No RLS policy violations

❌ **Problems to Fix**:
- Users seeing each other's data
- Anonymous users seeing any data
- INSERT/UPDATE operations without user_id checks
- Missing policies on any tables

## Troubleshooting

### "Email signups are disabled"
- Enable in Supabase Dashboard under Authentication > Providers
- Or create users manually in Authentication > Users

### "row-level security policy violation"
- Good! This means RLS is working and blocking unauthorized access
- Check that you're using the correct user ID in your tests

### "No data returned"
- Verify RLS policies are created (check pg_tables)
- Ensure test data was inserted successfully
- Check user IDs match between auth.users and your data

### Performance Issues
- Run the baseline queries from Phase 1
- Compare EXPLAIN ANALYZE results before/after RLS
- Check for missing indexes on user_id columns