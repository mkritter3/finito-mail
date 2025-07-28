# Row Level Security (RLS) Comprehensive Testing Plan

## Overview
This document outlines the comprehensive testing strategy for validating Row Level Security implementation in Finito Mail before staging deployment.

## Phase 1: Initial Testing (Immediate)

### 1.1 Create Staging Test Users
Create two test users in the staging environment:
- Test User A: `rls-test-a@finito-staging.com`
- Test User B: `rls-test-b@finito-staging.com`

### 1.2 SQL Impersonation Tests
Execute manual RLS verification queries in Supabase SQL Editor:

```sql
-- Test 1: Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('email_metadata', 'email_rules_v2', 'google_auth_tokens', 'sync_status');

-- Test 2: Impersonate User A
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"<user_a_uuid>", "role":"authenticated"}';

-- Should only return User A's data
SELECT COUNT(*) as user_a_emails FROM email_metadata;
SELECT COUNT(*) as user_a_rules FROM email_rules_v2;

-- Should return 0 rows
SELECT COUNT(*) FROM email_metadata WHERE user_id = '<user_b_uuid>';

-- Reset role
RESET ROLE;

-- Test 3: Anonymous access (should return 0)
SET ROLE anon;
SELECT COUNT(*) FROM email_metadata;
RESET ROLE;
```

### 1.3 E2E Application Tests
Run existing E2E test suite against staging with RLS enabled:

```bash
# Set staging environment
export NEXT_PUBLIC_SUPABASE_URL=<staging_url>
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging_anon_key>

# Run E2E tests
npm run test:e2e
```

Key flows to validate:
- Authentication (login/logout)
- Email listing and pagination
- Email creation/update/deletion
- Rule management
- Bulk operations

## Phase 2: Automated Testing

### 2.1 Performance Baseline
Before RLS testing, capture baseline metrics:

```sql
-- Critical Query 1: Dashboard email list
EXPLAIN ANALYZE 
SELECT * FROM email_metadata 
WHERE user_id = '<test_user_id>' 
ORDER BY received_at DESC 
LIMIT 50;

-- Critical Query 2: Email search
EXPLAIN ANALYZE 
SELECT * FROM email_metadata 
WHERE user_id = '<test_user_id>' 
AND (subject ILIKE '%search%' OR from_email ILIKE '%search%')
LIMIT 20;

-- Critical Query 3: Rule execution check
EXPLAIN ANALYZE
SELECT r.*, ra.* 
FROM email_rules_v2 r
LEFT JOIN rule_actions ra ON ra.rule_id = r.id
WHERE r.user_id = '<test_user_id>' AND r.enabled = true;

-- Critical Query 4: Bulk update
EXPLAIN ANALYZE
UPDATE email_metadata 
SET is_read = true 
WHERE user_id = '<test_user_id>' 
AND id = ANY(ARRAY['<id1>', '<id2>', '<id3>']);
```

### 2.2 Index Verification
Ensure all user_id columns have indexes:

```sql
-- Check existing indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('email_metadata', 'email_rules_v2', 'google_auth_tokens', 'sync_status')
AND indexdef LIKE '%user_id%';

-- Create missing indexes if needed
CREATE INDEX IF NOT EXISTS idx_email_metadata_user_id ON email_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_user_id ON email_rules_v2(user_id);
-- etc...
```

### 2.3 RLS Test Suite Execution
Set up ephemeral test database for CI/CD:

```bash
# Script: scripts/test-rls-ephemeral.sh
#!/bin/bash

# 1. Create ephemeral project
TEMP_PROJECT=$(supabase projects create --name "rls-test-$(date +%s)")

# 2. Apply migrations
supabase db push --project-ref $TEMP_PROJECT

# 3. Run RLS test suite
npm run test:rls -- --project-ref $TEMP_PROJECT

# 4. Cleanup
supabase projects delete --project-ref $TEMP_PROJECT
```

## Phase 3: Monitoring Setup

### 3.1 pgAudit Configuration
Configure audit logging conservatively:

```sql
-- Apply to entire database (not just role)
ALTER DATABASE postgres SET pgaudit.log = 'write, ddl';

-- Verify setting
SHOW pgaudit.log;
```

### 3.2 Application-Level Monitoring
Implement structured logging for RLS scenarios:

```typescript
// utils/rls-monitor.ts
export function logRLSCheck(context: {
  userId: string;
  resource: string;
  operation: string;
  resultCount: number;
  expectedMinimum?: number;
}) {
  if (context.resultCount === 0) {
    logger.warn({
      ...context,
      type: 'RLS_EMPTY_RESULT',
      timestamp: new Date().toISOString()
    }, 'RLS Check: Query returned no results');
  }
  
  if (context.expectedMinimum && context.resultCount < context.expectedMinimum) {
    logger.error({
      ...context,
      type: 'RLS_UNEXPECTED_COUNT',
      timestamp: new Date().toISOString()
    }, 'RLS Check: Result count below expected minimum');
  }
}
```

### 3.3 Rollback Preparation
Emergency RLS disable script:

```sql
-- File: scripts/emergency-rls-disable.sql
-- ONLY USE IN EMERGENCY - This completely disables security!

BEGIN;

-- Disable RLS on all tables
ALTER TABLE email_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_metadata_enhanced DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_rules_v2 DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_auth_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_watch DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE rule_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rule_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rule_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE async_rule_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_content_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

-- Verify all disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- If empty result, commit. Otherwise rollback.
COMMIT;
```

## Success Criteria

### Phase 1 Success:
- [ ] Test users created and can authenticate
- [ ] SQL impersonation shows proper data isolation
- [ ] E2E tests pass with no RLS-related failures
- [ ] No performance degradation > 20%

### Phase 2 Success:
- [ ] All user_id columns have indexes
- [ ] Query plans show Index Scans (not Seq Scans)
- [ ] RLS test suite passes 100%
- [ ] Bulk operations complete in < 2 seconds

### Phase 3 Success:
- [ ] pgAudit configured and logging writes
- [ ] Application monitoring deployed
- [ ] Rollback script tested on staging
- [ ] Team trained on RLS debugging

## Timeline
- **Day 1 (Today)**: Complete Phase 1
- **Day 2**: Complete Phase 2 automated testing
- **Day 3**: Complete Phase 3 monitoring setup
- **Day 4-5**: Run comprehensive staging tests
- **Day 6**: Go/No-Go decision for production

## Risk Mitigation
1. **Performance Impact**: Monitor query times, have index creation scripts ready
2. **Access Issues**: Test rollback procedure, have support team ready
3. **Data Leaks**: Run security test suite before each deployment
4. **Monitoring Gaps**: Set up alerts for empty result sets on critical queries