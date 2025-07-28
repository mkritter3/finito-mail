# RLS Phase 1: Manual Testing Instructions

## What You Need to Do

### 1. Set Up Test Users in Staging

First, you need to create test users in your staging environment. Make sure you have these environment variables set:

```bash
# In your .env.local file:
NEXT_PUBLIC_SUPABASE_URL=<your-staging-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-staging-service-role-key>
```

Then run:
```bash
npm run test:rls:setup
```

This will:
- Create two test users (rls-test-a@finito-staging.com and rls-test-b@finito-staging.com)
- Create sample emails and rules for each user
- Output their user IDs for SQL testing
- Generate a test script at `scripts/rls-impersonation-tests.sh`

**Save the output!** You'll need the user IDs for the next step.

### 2. Run SQL Impersonation Tests

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy the SQL queries from the generated script output (or from `scripts/rls-impersonation-tests.sh`)
5. Replace the placeholder user IDs with the actual IDs from step 1
6. Run each query block and verify:
   - RLS is enabled on all tables
   - User A can only see their own data
   - User B can only see their own data
   - Anonymous users see no data
   - Cross-user access returns 0 rows

### 3. Test the Application

Test the application with the test users:

```bash
# Set staging environment
export NEXT_PUBLIC_SUPABASE_URL=<your-staging-url>
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-staging-anon-key>

# Start the app
npm run dev
```

Test these flows:
1. **Login as Test User A** (rls-test-a@finito-staging.com)
   - Verify you see 5 test emails
   - Verify you see 2 test rules
   - Try creating a new email/rule
   - Try bulk operations

2. **Login as Test User B** (rls-test-b@finito-staging.com)
   - Verify you see DIFFERENT emails (5 for User B)
   - Verify you see DIFFERENT rules (2 for User B)
   - Ensure you cannot see User A's data

3. **Test Edge Cases**
   - Logout and verify no data is visible
   - Try accessing protected routes without auth
   - Test session expiry handling

### 4. Run E2E Tests

Run the existing E2E test suite against staging:

```bash
# Make sure you're pointing to staging
export NEXT_PUBLIC_SUPABASE_URL=<your-staging-url>
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-staging-anon-key>

# Run E2E tests
npm run test:e2e
```

## Expected Results

### ✅ Success Criteria:
- [ ] All tables show `rowsecurity = true`
- [ ] Each user can only see their own data
- [ ] Anonymous access returns empty results
- [ ] Application works normally with RLS enabled
- [ ] No performance degradation > 20%
- [ ] E2E tests pass

### ❌ If Something Fails:
1. **Check the Supabase logs** for RLS policy violations
2. **Verify the policies** are correctly applied (check Authentication > Policies)
3. **Check indexes** exist on user_id columns (performance issues)
4. **Use the rollback script** if needed (in emergency only)

## Next Steps

Once Phase 1 passes:
1. Document any issues found
2. Note performance metrics
3. Proceed to Phase 2 (automated testing)

## Emergency Rollback

If critical issues occur, you can disable RLS:

```sql
-- In Supabase SQL Editor (EMERGENCY ONLY!)
ALTER TABLE email_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_rules_v2 DISABLE ROW LEVEL SECURITY;
-- ... etc for all tables
```

**WARNING**: This completely disables security. Only use in emergencies!