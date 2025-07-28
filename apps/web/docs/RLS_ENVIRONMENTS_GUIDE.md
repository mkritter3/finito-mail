# RLS Testing Environments Guide

## Overview

This guide clarifies the different environments for RLS testing and when to use each.

**Current Status: We are in development stage, focusing on local development.**

## Environment Types

### 1. Local Development (Current Focus)
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
**👉 Currently using this for all development**

### Use Staging For:
✅ Final validation before production
✅ Testing with production-like data
✅ Integration testing with other services
✅ Performance testing at scale
❌ Not ideal for initial development (restrictions)
**👉 Will use this after local development is complete**

### Use Production For:
✅ Live user data only
❌ Never for testing or development

## Local Development Setup

### 1. Start Local Supabase
```bash
# From project root
npx supabase start
```

### 2. Fix Local Schema
```bash
# Generate schema fix (first time only)
npm run fix:local-schema

# Apply in Supabase Studio
# http://localhost:54323 → SQL Editor
```

### 3. Apply RLS Policies
```bash
# Generate RLS migration if not exists
npm run rls:phase2:generate-migration

# Apply to local database
npm run rls:apply-local
```

### 4. Create Demo Users
```bash
# Creates 3 demo users with sample data
npm run demo:create-users
```

### 5. Test RLS
```bash
# Run automated tests
npm run rls:phase2:verify

# Or test manually at http://localhost:3000/auth/dev
```

## Demo Users (Local Only)

| User | Email | Password | Role | Purpose |
|------|-------|----------|------|---------|
| Alice | alice@demo.local | demo123456 | user | Test user isolation |
| Bob | bob@demo.local | demo123456 | user | Test cross-user access |
| Charlie | charlie@demo.local | demo123456 | admin | Test admin privileges |

Each demo user comes with:
- 15 sample emails (if schema fix applied)
- 3 email rules
- Various read states

## Quick Commands

### Local Development
```bash
# Complete local setup
npm run demo:setup

# Fix schema issues
npm run fix:local-schema

# Just create users
npm run demo:create-users

# Just setup RLS
npm run demo:setup-rls

# Verify RLS
npm run rls:verify-enabled
npm run rls:phase2:verify
```

### Staging Testing (Future)
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
1. Use local development instead (recommended during development)
2. Create users manually in Supabase Dashboard
3. Ask admin to enable signups temporarily

### "Foreign key constraint violations"
Need to fix local schema first:
```bash
npm run fix:local-schema
# Then apply SQL in Supabase Studio
```

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

### 1. Local Development (Current Stage)
- Develop and test RLS policies ✅
- Fix schema issues ✅
- Create comprehensive test suite ✅
- Verify basic functionality 🚧
- Build UI with RLS 🚧

### 2. Staging Validation (Future)
- Apply same migrations
- Test with production-like data
- Verify integrations work
- Performance testing
- Security audit

### 3. Production Deployment (Future)
- Apply migrations during maintenance
- Monitor for violations
- Have rollback plan ready
- Gradual rollout with feature flags

---

**Remember**: We're currently in local development. Staging and production workflows are documented for future use.