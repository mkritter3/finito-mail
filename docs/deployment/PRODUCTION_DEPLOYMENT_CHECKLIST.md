# ✅ Production Deployment Checklist

This checklist ensures all components are properly configured for production deployment of Finito Mail.

## 🎯 Pre-Deployment Verification

### ✅ Production Blockers Resolved
- [x] **OAuth Tests** - 100% pass rate achieved
- [x] **Performance Monitoring** - Sentry APM implemented
- [x] **Real-Time Sync** - Webhooks + SSE + Fallback implemented

## 🔐 Environment Configuration

### 1. Authentication & Security
```env
# Supabase Authentication
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Session Security
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Production URL
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 2. Database & Cache
```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/finito_mail

# Redis (for Pub/Sub - Upstash doesn't support Pub/Sub)
REDIS_URL=redis://user:password@host:6379

# Upstash Redis (for rate limiting, caching)
UPSTASH_REDIS_URL=https://your-instance.upstash.io
UPSTASH_REDIS_TOKEN=your-token
```

### 3. Monitoring (Sentry)
```env
# Sentry APM
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_DSN@sentry.io/PROJECT_ID
SENTRY_DSN=https://YOUR_DSN@sentry.io/PROJECT_ID
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=finito-mail
SENTRY_AUTH_TOKEN=your-auth-token

# Health Check
HEALTH_CHECK_API_KEY=generate-secure-random-key
```

### 4. Real-Time Sync (Pub/Sub)
```env
# Google Cloud Pub/Sub
PUBSUB_VERIFICATION_TOKEN=generate-secure-random-token
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-push-notifications
GCLOUD_PROJECT_ID=your-project-id
```

### 5. Application Settings
```env
# Environment
NODE_ENV=production
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_APP_URL=https://your-domain.com

# API Keys
ENCRYPTION_KEY=generate-32-byte-key
```

## 📦 Database Setup

### 1. Run Migrations
```bash
# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Verify schema
npx prisma db pull
```

### 2. Required Schema Updates
Add these models if not present:
- `GmailWatch` - For push notification tracking
- `SyncStatus` - For sync state management

## 🔐 Supabase OAuth Setup

### 1. Configure Google OAuth in Supabase
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add your Google OAuth credentials:
   - Client ID: From Google Cloud Console
   - Client Secret: From Google Cloud Console
4. Copy the redirect URL provided by Supabase

### 2. Update Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add Supabase redirect URL to authorized redirect URIs
3. Ensure Gmail API is enabled
4. Required scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`

## ☁️ Google Cloud Setup (for Real-Time Sync)

### 1. Enable APIs
```bash
gcloud services enable gmail.googleapis.com
gcloud services enable pubsub.googleapis.com
```

### 2. Create Pub/Sub Resources
```bash
# Create topic
gcloud pubsub topics create gmail-push-notifications

# Create subscription
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://your-domain.com/api/webhooks/gmail \
  --ack-deadline=10

# Grant Gmail permission
gcloud pubsub topics add-iam-policy-binding gmail-push-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

## 🚀 Deployment Steps

### 1. Build Application
```bash
# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

# Verify build
npm run start:prod
```

### 2. Infrastructure Setup
- [ ] SSL certificate configured
- [ ] Domain DNS pointing to server
- [ ] Reverse proxy configured (Nginx/Caddy)
- [ ] Process manager setup (PM2/systemd)
- [ ] Backup strategy implemented

### 3. Security Hardening
- [ ] Rate limiting configured
- [ ] CORS properly set
- [ ] CSP headers enabled
- [ ] Security headers verified
- [ ] API keys rotated

## 🧪 Post-Deployment Testing

### 1. Health Checks
```bash
# Basic health check
curl https://your-domain.com/api/health

# Authenticated health check
curl -H "x-health-api-key: YOUR_KEY" https://your-domain.com/api/health
```

### 2. Authentication Flow
- [ ] Supabase OAuth login works
- [ ] Google provider authentication successful
- [ ] Gmail API tokens accessible from session
- [ ] Session persistence verified
- [ ] Logout functionality confirmed
- [ ] Token refresh handled by Supabase

### 3. Real-Time Sync
- [ ] Register Gmail watch
- [ ] Send test email
- [ ] Verify webhook receives notification
- [ ] Check SSE delivers update to client
- [ ] Test fallback polling activation

### 4. Monitoring Verification
- [ ] Sentry receiving errors
- [ ] Performance metrics tracked
- [ ] Health endpoint monitored externally
- [ ] Alerts configured and tested

## 📊 Performance Targets

### Key Metrics
- **API Response Time**: p95 < 200ms
- **SSE Latency**: < 100ms
- **Error Rate**: < 0.1%
- **Uptime**: > 99.9%

### Load Testing
```bash
# Basic load test
ab -n 1000 -c 10 https://your-domain.com/api/health

# SSE connection test
for i in {1..100}; do
  curl -N https://your-domain.com/api/sse/email-updates &
done
```

## 🚨 Monitoring Setup

### 1. External Monitoring
- [ ] UptimeRobot or Pingdom configured
- [ ] Health check every 1 minute
- [ ] SSL certificate monitoring
- [ ] Domain expiration alerts

### 2. Sentry Alerts
- [ ] Error rate threshold (>100/10min)
- [ ] Memory usage (>90%)
- [ ] API performance (p95 >3s)
- [ ] Authentication failures (>50/5min)

### 3. Custom Dashboards
- [ ] Real-time sync success rate
- [ ] OAuth flow completion rate
- [ ] API quota usage
- [ ] Active SSE connections

## 📝 Documentation Updates

### For Your Team
- [ ] Update README with production URLs
- [ ] Document environment variables
- [ ] Create runbook for common issues
- [ ] Document deployment process

### For Users
- [ ] Privacy policy updated
- [ ] Terms of service ready
- [ ] Google OAuth consent screen configured
- [ ] Supabase project settings documented
- [ ] Support documentation prepared

## 🔄 Rollback Plan

### Quick Rollback Steps
1. Keep previous build artifacts
2. Database migration rollback scripts ready
3. Environment variable backups
4. DNS quick-switch capability

### Rollback Commands
```bash
# Revert to previous version
git checkout previous-tag
npm install
npm run build
pm2 restart finito-mail

# Database rollback if needed
npx prisma migrate resolve --rolled-back
```

## 🎉 Launch Checklist

### Final Verification
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Team trained on procedures

### Go-Live Steps
1. [ ] Deploy to production
2. [ ] Verify all services healthy
3. [ ] Test critical user flows
4. [ ] Monitor for 1 hour
5. [ ] Announce launch

## 📞 Emergency Contacts

Document these for your team:
- **Primary Engineer**: 
- **DevOps Contact**: 
- **Sentry Alerts Go To**: 
- **Google Cloud Support**: 

---

**Remember**: This checklist should be customized for your specific deployment environment. Mark items as completed as you progress through deployment.