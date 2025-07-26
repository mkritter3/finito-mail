# 📋 API App Deprecation & Migration Plan

**Last Updated**: 2025-01-25  
**Status**: Part of Broader Infrastructure Migration  
**Timeline**: Aligned with Phase 5 (Week 9)

## 🔗 Context

This deprecation is part of our broader [Infrastructure Migration](./INFRASTRUCTURE_ROADMAP.md) initiative to replace custom implementations with battle-tested solutions. See our [Architecture Evolution](./ARCHITECTURE_EVOLUTION.md) for the complete transformation vision.

## Overview

The Finito Mail codebase currently contains two authentication systems:

1. **Web App** (`apps/web`): Uses Supabase OAuth ✅ **(CURRENT STANDARD)**
2. **API App** (`apps/api`): Uses direct Google OAuth ❌ **(DEPRECATED)**

This document outlines the plan to phase out the API app's legacy authentication system and consolidate all authentication through Supabase OAuth.

## 🎯 Migration Goals

1. **Eliminate duplicate authentication systems** - Single source of truth
2. **Improve security** - Leverage Supabase's built-in OAuth handling
3. **Reduce maintenance** - One authentication system to maintain
4. **Simplify architecture** - Cleaner, more understandable codebase

## ⚠️ Current State

### Web App (Correct Implementation)
```typescript
// apps/web/src/lib/supabase.ts
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Gmail tokens accessed from Supabase session
const { data: { session } } = await supabase.auth.getSession()
const accessToken = session.provider_token
const refreshToken = session.provider_refresh_token
```

### API App (Deprecated Implementation)
```typescript
// apps/api/app/api/auth/google/route.ts
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/callback`
);
```

## 📊 Migration Status

### Current Progress
```
Deprecation Progress: ████████░░░░░░░░░░░░ 40%

Documentation:     ████████████████████ 100% ✅
Code Analysis:     ████████████████████ 100% ✅  
Implementation:    ░░░░░░░░░░░░░░░░░░░░  0% ⏳
Cleanup:          ░░░░░░░░░░░░░░░░░░░░  0% ⏳
```

### Alignment with Infrastructure Roadmap

This deprecation is scheduled for **Phase 5** (Week 9) of our infrastructure migration:

| Infrastructure Phase | Week | API Deprecation Work |
|---------------------|------|---------------------|
| Phase 1: Inngest | 1-2 | - |
| Phase 2: Gmail API | 3-4 | Prepare token migration |
| Phase 3: Realtime | 5-7 | - |
| Phase 4: Testing | 8 | Test auth migration |
| **Phase 5: Cleanup** | **9** | **Complete API deprecation** |

## 📊 Migration Checklist

### Phase 1: Documentation & Warnings ✅ **COMPLETE**
- [x] Add deprecation notice to README.md
- [x] Add warning comments to all API auth files
- [x] Create this migration tracking document
- [x] Update CONTRIBUTING.md with auth guidelines

### Phase 2: Code Analysis ✅ **COMPLETE**
- [x] Identify all API endpoints using legacy auth
- [x] Map dependencies on `google_auth_tokens` table
- [x] List all files importing from `apps/api/lib/auth.ts`
- [x] Document environment variables to remove

### Phase 3: Migration Implementation ⏳ **PLANNED**
- [ ] Migrate `/api/auth/google` endpoints to use Supabase
- [ ] Update `/api/auth/me` to use Supabase session
- [ ] Migrate Gmail API token retrieval to Supabase
- [ ] Update webhook handlers to use Supabase auth
- [ ] Remove `google_auth_tokens` database table

### Phase 4: Cleanup 🧹
- [ ] Remove all legacy OAuth code from API app
- [ ] Remove unused environment variables:
  - `GOOGLE_CLIENT_ID` (API version)
  - `GOOGLE_CLIENT_SECRET` (API version)
  - `GOOGLE_REDIRECT_URI`
- [ ] Update all documentation
- [ ] Remove this deprecation plan (migration complete!)

## 🚨 Files to Update

### High Priority (Core Auth Logic)
1. `apps/api/app/api/auth/google/route.ts` - Main OAuth handler
2. `apps/api/app/api/auth/me/route.ts` - User session endpoint
3. `apps/api/lib/auth.ts` - Auth utilities
4. `apps/api/lib/auth-test.ts` - Test auth utilities

### Medium Priority (Dependent Features)
1. `apps/api/app/api/emails/*/route.ts` - Email endpoints using auth
2. `apps/api/app/api/webhooks/gmail/route.ts` - Webhook handlers
3. `apps/api/lib/gmail-batch-service.ts` - Gmail API service

### Low Priority (Configuration)
1. `.env.local` - Remove deprecated variables
2. `apps/api/middleware.ts` - Update auth middleware
3. Database migrations - Remove `google_auth_tokens` table

## 🛠️ Migration Guide for Developers

### DO ✅
- Use `apps/web/src/lib/supabase.ts` for all authentication
- Access Gmail tokens via Supabase session
- Follow the pattern in `apps/web/src/app/auth/callback/page.tsx`

### DON'T ❌
- Import anything from `apps/api/lib/auth.ts`
- Use `google.auth.OAuth2` directly
- Store tokens in the `google_auth_tokens` table
- Add new features using the API app's auth

### Example: Migrating an API Endpoint

**Before (Deprecated):**
```typescript
import { getGoogleTokens } from '@/lib/auth';

export async function GET(request: Request) {
  const tokens = await getGoogleTokens(userId);
  // Use tokens...
}
```

**After (Correct):**
```typescript
import { supabase } from '@finito/web/lib/supabase';

export async function GET(request: Request) {
  const { data: { session } } = await supabase.auth.getSession();
  const tokens = {
    accessToken: session.provider_token,
    refreshToken: session.provider_refresh_token
  };
  // Use tokens...
}
```

## 📅 Timeline

- **Week 1-2**: Documentation and warnings
- **Week 3-4**: Code analysis and planning
- **Week 5-8**: Migration implementation
- **Week 9-10**: Testing and validation
- **Week 11-12**: Cleanup and removal

## 🔍 Tracking

- **Epic**: #[TBD] - API App Authentication Phase-Out
- **Slack Channel**: #finito-auth-migration
- **Point of Contact**: @[tech-lead]

## ⚡ Quick Reference

| Feature | Old (Deprecated) | New (Use This) |
|---------|------------------|----------------|
| Auth Client | `google.auth.OAuth2` | `supabase.auth` |
| Login | `/api/auth/google` | `/auth` (Supabase) |
| Get Tokens | `getGoogleTokens()` | `supabase.auth.getSession()` |
| Token Storage | `google_auth_tokens` table | Supabase session |
| Refresh Token | Manual refresh logic | Automatic by Supabase |

---

**Remember**: This is a transitional period. When in doubt, always choose the Supabase OAuth approach and ask in #finito-auth-migration if you have questions!