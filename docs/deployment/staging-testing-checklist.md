# 🧪 Staging Environment Testing Checklist

This checklist ensures all authentication and core features work correctly after the Supabase SSR migration.

## Pre-Deployment Checks

### Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Set to staging Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Set to staging anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Set to staging service role key
- [ ] `NEXTAUTH_URL` - Set to `https://staging.finito.mail`
- [ ] `NEXTAUTH_SECRET` - Generated secure random string

### Supabase Configuration
- [ ] Google OAuth provider enabled in Supabase Dashboard
- [ ] Redirect URLs configured for staging domain
- [ ] RLS policies enabled on all tables

## Authentication Testing

### 1. Initial Login Flow
- [ ] Navigate to staging URL
- [ ] Verify redirect to `/auth` when not logged in
- [ ] Click "Sign in with Google"
- [ ] Complete OAuth flow
- [ ] Verify redirect back to `/mail/inbox`
- [ ] Check browser DevTools > Application > Cookies for:
  - `sb-<project-ref>-auth-token` (HTTP-only cookie)
  - No localStorage tokens

### 2. Session Persistence
- [ ] Refresh the page - should remain logged in
- [ ] Open new tab - should be logged in
- [ ] Close browser and reopen - should remain logged in
- [ ] Wait 1 hour - session should auto-refresh

### 3. Logout Flow
- [ ] Click user avatar > Sign out
- [ ] Verify redirect to `/auth`
- [ ] Verify cookies are cleared
- [ ] Try accessing `/mail/inbox` - should redirect to `/auth`

## Core Feature Testing

### 4. Email List Loading
- [ ] Navigate to `/mail/inbox`
- [ ] Verify emails load from database
- [ ] Check server logs for successful auth checks
- [ ] Verify no client-side auth errors

### 5. Bulk Actions
- [ ] Select multiple emails
- [ ] Click bulk action (archive/delete)
- [ ] Verify optimistic UI update
- [ ] Verify server action completes
- [ ] Refresh page - changes should persist

### 6. Email Sync
- [ ] Click sync button in header
- [ ] Verify sync starts (loading indicator)
- [ ] Check server logs for Gmail API calls
- [ ] Verify new emails appear

### 7. Navigation
- [ ] Click through different folders (Sent, Drafts, etc.)
- [ ] Verify URL updates
- [ ] Verify correct emails load
- [ ] Check no auth errors in console

## Edge Cases

### 8. Token Refresh
- [ ] Open DevTools > Network tab
- [ ] Wait for token refresh (check for TOKEN_REFRESHED event)
- [ ] Verify `router.refresh()` is called
- [ ] Verify next server action works correctly

### 9. Multiple Tabs
- [ ] Open app in two tabs
- [ ] Log out in one tab
- [ ] Switch to other tab - should redirect to `/auth`

### 10. Direct URL Access
- [ ] While logged out, try accessing `/mail/inbox` directly
- [ ] Should redirect to `/auth`
- [ ] Log in and try accessing protected routes directly
- [ ] Should load correctly

## Performance Checks

### 11. Server Component Performance
- [ ] Check initial page load time
- [ ] Verify server-side data fetching
- [ ] Check no unnecessary client-side auth checks
- [ ] Monitor server response times

### 12. Client-Side Hydration
- [ ] Check browser console for hydration errors
- [ ] Verify AuthProvider initializes correctly
- [ ] Check no flickering on page load

## Security Verification

### 13. Cookie Security
- [ ] Inspect cookies in DevTools
- [ ] Verify HTTP-only flag is set
- [ ] Verify Secure flag (HTTPS only)
- [ ] Verify SameSite attribute

### 14. API Protection
- [ ] Try calling server actions without auth
- [ ] Should return unauthorized error
- [ ] Check server logs for auth validation

### 15. RLS Policies
- [ ] Query Supabase directly with user token
- [ ] Verify can only see own emails
- [ ] Verify cannot access other users' data

## Error Scenarios

### 16. Network Errors
- [ ] Disable network and try actions
- [ ] Should show appropriate error messages
- [ ] Re-enable network - should recover

### 17. Invalid Session
- [ ] Manually delete auth cookie
- [ ] Try performing action
- [ ] Should redirect to `/auth`

## Monitoring

### 18. Logs and Metrics
- [ ] Check Railway logs for errors
- [ ] Verify structured logging works
- [ ] Check for any unhandled rejections
- [ ] Monitor memory usage

### 19. Health Check
- [ ] Access `/api/health`
- [ ] Should return 200 OK
- [ ] Verify all services report healthy

## Sign-off

- [ ] All authentication flows work correctly
- [ ] No localStorage usage for auth tokens
- [ ] Server-side auth checks functioning
- [ ] Client-server session sync working
- [ ] No security vulnerabilities found
- [ ] Performance is acceptable
- [ ] Ready for production deployment

## Notes

_Add any issues found during testing:_

---

**Tested by:** ________________  
**Date:** ________________  
**Environment:** Staging  
**Build:** ________________