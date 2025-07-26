# 🔧 Troubleshooting & FAQ

This section contains solutions to common issues and frequently asked questions about Finito Mail.

## 📋 Quick Navigation

### Common Issues
- [Authentication Problems](#authentication-problems)
- [Real-Time Sync Issues](#real-time-sync-issues)
- [Redis Connection Errors](#redis-connection-errors)
- [Build & Deployment Issues](#build--deployment-issues)
- [Performance Problems](#performance-problems)

### FAQ Categories
- [General Questions](./faq/general.md)
- [Technical Questions](./faq/technical.md)
- [Security Questions](./faq/security.md)

---

## 🔍 Common Issues & Solutions

### Authentication Problems

#### "user_creation_failed" Error
**Problem**: Getting authentication error when trying to sign in with Google.

**Solution**:
1. Verify Supabase environment variables are correctly set:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   ```
2. Check Google OAuth is properly configured in Supabase Dashboard
3. Ensure redirect URLs match your environment
4. Clear browser cache and localStorage

#### OAuth Tokens Not Refreshing
**Problem**: Gmail API calls failing with 401 after some time.

**Solution**:
1. Verify `access_type: 'offline'` is set in OAuth config
2. Check token refresh logic in `/src/lib/supabase.ts`
3. Ensure `prompt: 'consent'` forces new refresh token

### Real-Time Sync Issues

#### Webhook Not Receiving Gmail Updates
**Problem**: Gmail changes not appearing in real-time.

**Solution**:
1. Verify Pub/Sub subscription configuration:
   ```bash
   gcloud pubsub subscriptions describe gmail-push-sub
   ```
2. Check webhook endpoint is accessible:
   ```bash
   curl -X POST https://your-domain/api/webhooks/gmail \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```
3. Verify PUBSUB_VERIFICATION_TOKEN matches
4. Check Gmail watch is active:
   ```sql
   SELECT * FROM gmail_watch WHERE user_id = 'your-user-id';
   ```

#### SSE Connection Dropping
**Problem**: Real-time updates stop after a few minutes.

**Solution**:
1. Check for proxy timeouts (Railway has 5-minute timeout)
2. Verify heartbeat is working (30-second intervals)
3. Check client reconnection logic in `use-real-time-sync.ts`
4. Monitor server logs for connection errors

### Redis Connection Errors

#### "Upstash doesn't support Pub/Sub" Error
**Problem**: Redis Pub/Sub commands failing.

**Solution**:
- You MUST use standard Redis, not Upstash
- Options:
  - Redis Cloud (recommended)
  - Railway Redis
  - AWS ElastiCache
  - Local Redis for development

#### Redis Connection Timeout
**Problem**: Can't connect to Redis instance.

**Solution**:
1. Test connection directly:
   ```bash
   redis-cli -u $REDIS_URL ping
   ```
2. Check firewall/security group rules
3. Verify Redis URL format: `redis://username:password@host:port`
4. For Railway: Ensure Redis service is running

### Build & Deployment Issues

#### Next.js Build Failing
**Problem**: Build errors during deployment.

**Solution**:
1. Run build locally first:
   ```bash
   npm run build
   ```
2. Check for missing environment variables
3. Verify all imports are correct
4. Clear `.next` cache:
   ```bash
   rm -rf .next
   npm run build
   ```

#### Railway Deployment Failing
**Problem**: Deployment succeeds but app crashes.

**Solution**:
1. Check Railway logs:
   ```bash
   railway logs
   ```
2. Verify all environment variables are set in Railway
3. Check `railway.toml` configuration
4. Ensure health check endpoint works:
   ```bash
   curl https://your-app.up.railway.app/api/health
   ```

### Performance Problems

#### Slow Email List Loading
**Problem**: Email list takes too long to render.

**Solution**:
1. Check if virtualization is working (`@tanstack/react-virtual`)
2. Verify IndexedDB queries are using indexes
3. Monitor bundle size:
   ```bash
   npm run analyze
   ```
4. Check for unnecessary re-renders with React DevTools

#### High Memory Usage
**Problem**: Browser tab using excessive memory.

**Solution**:
1. Implement pagination for large email lists
2. Clear old emails from IndexedDB
3. Check for memory leaks in email store
4. Use `weak` references for email cache

---

## 🚀 Quick Fixes

### Reset Authentication
```bash
# Clear all auth data
localStorage.clear()
sessionStorage.clear()
# Reload the page
window.location.reload()
```

### Force Sync
```javascript
// In browser console
await window.__emailStore?.syncEmails(true)
```

### Check System Status
```bash
# Health check
curl https://your-app/api/health

# Redis status
redis-cli -u $REDIS_URL info server

# Pub/Sub status
gcloud pubsub subscriptions list
```

---

## 📞 Getting Help

If you can't find a solution here:

1. **Check the logs** - Most issues are visible in logs
2. **Search existing issues** - Someone may have had the same problem
3. **Ask in discussions** - Community can help
4. **Create an issue** - Include reproduction steps

### Information to Include
- Error messages (full stack trace)
- Environment (development/production)
- Browser and version
- Steps to reproduce
- Expected vs actual behavior

---

## 🔗 Related Documentation

- [Environment Setup](../getting-started/ENVIRONMENT_SETUP.md)
- [Real-Time Sync Setup](../features/REAL_TIME_SYNC.md)
- [Security Patterns](../architecture/SECURITY_PATTERNS.md)
- [Monitoring Setup](../deployment/MONITORING.md)