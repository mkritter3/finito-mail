# pgAudit Setup Instructions for Supabase

## Overview

pgAudit provides detailed session and object audit logging for PostgreSQL. This is crucial for monitoring RLS policy violations and tracking data access patterns.

## One-Time Setup Instructions

### 1. Enable pgAudit Extension

1. Go to your Supabase Dashboard
2. Navigate to **Database > Extensions**
3. Search for "pgaudit"
4. Click "Enable" if not already enabled

### 2. Configure Audit Logging

Run the following SQL in your Supabase SQL Editor:

```sql
-- Configure pgAudit for the postgres role
-- This logs write operations and DDL changes
ALTER ROLE postgres SET pgaudit.log = 'write, ddl';

-- Optional: Configure for API traffic
-- This logs operations from your application
ALTER ROLE authenticator SET pgaudit.log = 'write';

-- Apply settings (may require reconnection)
SELECT pg_reload_conf();
```

### 3. Verify Configuration

```sql
-- Check current settings
SHOW pgaudit.log;

-- View current role settings
SELECT 
  rolname,
  rolconfig
FROM pg_roles
WHERE rolname IN ('postgres', 'authenticator');
```

## Recommended Settings

### For Development/Staging
```sql
-- More verbose logging for debugging
ALTER ROLE postgres SET pgaudit.log = 'read, write, ddl';
```

### For Production
```sql
-- Conservative logging to minimize performance impact
ALTER ROLE postgres SET pgaudit.log = 'write, ddl';
```

## Viewing Audit Logs

1. Go to Supabase Dashboard
2. Navigate to **Logs > Postgres Logs**
3. Filter by:
   - `severity: log`
   - Search for "AUDIT"

### Example Log Queries

```sql
-- Find recent write operations
SELECT * FROM postgres_logs
WHERE event_message LIKE '%AUDIT%'
  AND event_message LIKE '%INSERT%'
ORDER BY timestamp DESC
LIMIT 100;

-- Find RLS policy violations
SELECT * FROM postgres_logs
WHERE event_message LIKE '%row-level security%'
  OR event_message LIKE '%permission denied%'
ORDER BY timestamp DESC;
```

## Important Considerations

### Performance Impact
- Audit logging has minimal impact for < 1000 writes/second
- For high-volume tables, consider selective logging
- Monitor log volume to avoid storage issues

### Security
- Never enable `pgaudit.log_parameter` (logs query parameters)
- This could expose sensitive data in encrypted columns
- Audit logs may contain sensitive information - restrict access

### Log Rotation
- Supabase automatically manages log rotation
- Logs are retained based on your plan limits
- Consider exporting critical logs for long-term storage

## Disabling Audit Logging

If needed, you can disable audit logging:

```sql
-- Reset to no logging
ALTER ROLE postgres RESET pgaudit.log;
ALTER ROLE authenticator RESET pgaudit.log;

-- Verify it's disabled
SHOW pgaudit.log;
```

## Alternative: Table-Based Auditing

For more control, consider Supabase's `supa_audit` extension:
- Writes audit data to tables instead of logs
- Easier to query and analyze
- Better for long-term audit trails
- See: https://github.com/supabase/supa_audit

## Monitoring RLS with pgAudit

While pgAudit doesn't directly log "RLS violations", you can infer them:

1. **Empty result sets** after queries (user filtered out)
2. **Permission denied** errors
3. **Comparing** actual vs expected row counts

Example monitoring query:
```sql
-- Find potential RLS filtering
-- (queries that returned 0 rows)
SELECT 
  timestamp,
  user_name,
  event_message
FROM postgres_logs
WHERE event_message LIKE '%SELECT%'
  AND event_message LIKE '%returned 0 rows%'
ORDER BY timestamp DESC;
```

## Next Steps

1. Enable pgAudit in staging first
2. Monitor log volume for 24-48 hours
3. Adjust settings based on needs
4. Document any performance impact
5. Create alerts for suspicious patterns