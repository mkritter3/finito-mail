# RLS Testing Environments Guide

## Overview

This guide clarifies the different environments for RLS testing and when to use each.

## Environment Types

### 1. Local Development (Recommended for RLS Development)
- **URL**: `http://localhost:54321`
- **Config**: `.env.local`
- **Purpose**: Full control for development and testing
- **Supabase Studio**: `http://localhost:54323`

### 2. Staging Environment
- **URL**: `https://aaouupausotsxnlvpzjg.supabase.co`
- **Config**: `.env.staging`
- **Purpose**: Pre-production testing
- **Limitations**: Email signups disabled, limited admin access

### 3. Production Environment
- **URL**: (Not shown for security)
- **Config**: `.env.production`
- **Purpose**: Live application
- **Never test RLS here!**

## When to Use Each Environment

### Use Local Development For:
✅ Initial RLS policy development
✅ Creating test users freely
✅ Testing RLS policies without restrictions
✅ Performance baseline testing
✅ Debugging RLS issues
✅ Running automated tests

### Use Staging For:
✅ Final validation before production
✅ Testing with production-like data
✅ Integration testing with other services
✅ Performance testing at scale
❌ Not ideal for initial development (restrictions)

## Local Development Setup

### 1. Start Local Supabase
```bash
# From project root
npx supabase start
```

### 2. Apply RLS Policies
```bash
# Generate RLS migration if not exists
npm run rls:phase2:generate-migration

# Apply to local database
npm run demo:setup-rls
```

### 3. Create Demo Users
```bash
# Creates 3 demo users with sample data
npm run demo:create-users
```

### 4. Test RLS
```bash
# Run automated tests
npm run rls:phase2:verify

# Or test manually at http://localhost:3000
```

## Demo Users (Local Only)

| User | Email | Password | Role | Purpose |
|------|-------|----------|------|---------|
| Alice | alice@demo.local | demo123456 | user | Test user isolation |
| Bob | bob@demo.local | demo123456 | user | Test cross-user access |
| Charlie | charlie@demo.local | demo123456 | admin | Test admin privileges |

Each demo user comes with:
- 15 sample emails
- 3 email rules
- Various labels and read states

## Quick Commands

### Local Development
```bash
# Complete local setup
npm run demo:setup

# Just create users
npm run demo:create-users

# Just setup RLS
npm run demo:setup-rls

# Verify RLS
npm run rls:phase2:verify
```

### Staging Testing
```bash
# Use staging environment
export NODE_ENV=staging

# Generate test data SQL
npm run rls:generate-test-data

# Then manually:
# 1. Create users in Supabase Dashboard
# 2. Run generated SQL
# 3. Test manually
```

## Troubleshooting

### "This script is for LOCAL development only!"
You're trying to run local scripts against staging. Check your environment.

### "Email signups are disabled"
This happens in staging. Either:
1. Use local development instead
2. Create users manually in Supabase Dashboard
3. Ask admin to enable signups temporarily

### "RLS policies not working"
1. Check if RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables`
2. Verify policies exist: `SELECT * FROM pg_policies`
3. Test with SQL impersonation (see test queries)

### "Can't create test users"
1. Make sure local Supabase is running
2. Check you're using `.env.local`
3. Verify service role key is correct

## Best Practices

1. **Develop locally first** - Full control, no restrictions
2. **Test thoroughly** - Use automated tests + manual testing
3. **Document changes** - Update migration files
4. **Validate in staging** - Final check before production
5. **Monitor in production** - Use pgAudit for violations

## Migration Path

1. **Local Development**
   - Develop and test RLS policies
   - Create comprehensive test suite
   - Verify performance impact

2. **Staging Validation**
   - Apply same migrations
   - Test with production-like data
   - Verify integrations work

3. **Production Deployment**
   - Apply migrations during maintenance
   - Monitor for violations
   - Have rollback plan ready