# Supabase Database Configuration

This directory contains SQL migrations and scripts for the Finito Mail database.

## 🚨 Critical Security: Row Level Security (RLS)

**IMPORTANT**: RLS must be enabled and properly configured before any production deployment. Without RLS, authenticated users could potentially access all users' data.

### Migration Files

1. **`migrations/003_implement_rls_existing_tables.sql`** - Implements RLS for EXISTING Finito Mail tables
   - Works with existing table structure (`email_metadata`, `email_rules_v2`, etc.)
   - Enables RLS on all user data tables
   - Creates granular policies for SELECT, INSERT, UPDATE, DELETE
   - Includes WITH CHECK constraints to prevent user_id spoofing
   - Handles related tables with proper foreign key checks

### Archived Migrations
- `archive/001_create_tables.sql` - For new installations only (not needed for existing database)
- `archive/002_implement_rls_policies.sql` - Used wrong table names (replaced by 003)

### Applying RLS Policies

#### For Existing Database (Your Case)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy the entire contents of `migrations/003_implement_rls_existing_tables.sql`
5. Paste and run it
6. Verify: "RLS successfully enabled on all tables"

#### Option 2: Via Supabase CLI
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

### Testing RLS Policies

1. **Set up test users**:
   ```bash
   npm run test:rls:setup
   ```
   This creates two test users with sample data.

2. **Run RLS test suite**:
   ```bash
   npm run test:rls
   ```
   This runs comprehensive tests to verify:
   - Users cannot read each other's data
   - Users cannot insert data for other users
   - Users cannot update/delete other users' data
   - Real-time subscriptions respect RLS boundaries

### Verifying RLS in Production

After applying RLS, verify it's working:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('emails', 'rules', 'gmail_credentials', 'email_sync_state');

-- All should show rowsecurity = true

-- Test RLS (as any authenticated user)
SELECT count_other_user_emails('some-other-user-id');
-- Should return 0
```

### Rollback (Emergency Only)

If you need to rollback RLS (NOT recommended for production):
1. Use the rollback script at the bottom of the migration file
2. This will disable RLS and drop all policies
3. ⚠️ WARNING: This leaves your data completely unprotected

### Important Notes

1. **Service Role Key**: The service role key bypasses RLS. Only use it for admin operations, never expose it to clients.

2. **Testing**: Always test RLS policies in a staging environment first.

3. **Monitoring**: Set up alerts for any RLS policy violations in your logs.

4. **Updates**: When adding new tables with user data, always implement RLS policies immediately.

## Support

If you encounter issues with RLS implementation:
1. Check Supabase logs for policy violations
2. Ensure auth.uid() is properly set (user is authenticated)
3. Verify the user_id column exists and matches auth.uid()
4. Run the RLS test suite to identify specific policy issues