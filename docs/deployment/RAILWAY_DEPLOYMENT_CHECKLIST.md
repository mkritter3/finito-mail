# 🚀 Railway Deployment Checklist

## Pre-Deployment Checklist

### ✅ Prerequisites Completed
- [x] **Build Success**: Web app builds successfully with `npx turbo build --filter=@finito/web`
- [x] **Health Check**: `/api/health` endpoint created and tested
- [x] **Railway Config**: `railway.toml` optimized for monorepo deployment
- [x] **Server Actions**: Gmail API operations properly isolated on server-side
- [x] **Documentation**: Complete deployment guide and environment templates

### 🔧 Critical Configuration Steps

#### 1. Railway Project Setup
1. **Create Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Connect GitHub**: Link your GitHub account to Railway
3. **Create New Project**: Select "Deploy from GitHub repo"
4. **Select Repository**: Choose your Finito Mail repository
5. **Configure Branch**: Set to deploy from `main` branch (or your preferred branch)

#### 2. Environment Variables Configuration

**⚠️ CRITICAL**: These must be set correctly in Railway's Variables tab:

```env
# Supabase Authentication (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key

# Application Secrets (REQUIRED)
NEXTAUTH_SECRET=your-secure-random-secret-32-chars

# Gmail Real-Time Sync (REQUIRED)
GMAIL_PUBSUB_TOPIC=projects/your-project/topics/gmail-notifications
PUBSUB_VERIFICATION_TOKEN=your-verification-token

# Production Settings (REQUIRED)
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://your-railway-app.up.railway.app

# Optional (for enhanced features)
LOG_LEVEL=info
NEXT_TELEMETRY_DISABLED=1
```

**Generate NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

#### 3. Authentication Configuration

**A. Supabase Setup (REQUIRED)**:
1. **Create Production Project**: [supabase.com](https://supabase.com)
2. **Enable Google Provider**: 
   - Go to Authentication → Providers
   - Enable Google
   - Add OAuth credentials from step B
   - Copy the redirect URL

**B. Google Cloud OAuth Configuration**:
1. **Go to Google Cloud Console**: [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. **Create OAuth 2.0 Client ID** (if needed)
3. **Add to Authorized redirect URIs**:
   - Supabase redirect URL from step A
   - Your Railway app callback: `https://your-railway-app.up.railway.app/auth/callback`

#### 4. Railway Deployment Steps

1. **Initial Deploy**: Railway will auto-deploy on first connection
2. **Monitor Build**: Watch logs in Railway dashboard
3. **Check Health**: Verify `/api/health` endpoint responds
4. **Update OAuth**: Update Google Cloud Console with actual Railway URL
5. **Test Authentication**: Complete OAuth flow end-to-end

### 🔍 Post-Deployment Verification

#### Health Check Verification
```bash
# Check health endpoint
curl https://your-railway-app.up.railway.app/api/health

# Expected response:
{"status":"ok","timestamp":1234567890}
```

#### Authentication Flow Testing
1. **Access App**: Visit your Railway URL
2. **Login Test**: Click "Continue with Google"
3. **Supabase OAuth**: Complete authentication via Supabase
4. **Redirect Success**: Verify return to app after auth
5. **Session Persistence**: Refresh page, verify still logged in
6. **Gmail Access**: Verify Gmail API tokens are available

#### Core Functionality Testing
1. **Email Sync**: Test syncing recent emails
2. **Server Actions**: Verify Gmail API operations work
3. **Error Handling**: Check logs for any runtime errors
4. **Performance**: Verify app loads within health check timeout

### 🚨 Common Issues & Solutions

#### OAuth Redirect Mismatch
**Error**: `redirect_uri_mismatch`
**Solution**: Ensure Google Cloud Console URIs exactly match Railway URL

#### Health Check Failures
**Error**: Deployment fails health check
**Solution**: 
- Verify `/api/health` endpoint works locally
- Check Railway logs for startup errors
- Ensure proper port binding with `$PORT`

#### Build Failures
**Error**: Build fails in Railway
**Solution**:
- Verify `npx turbo build --filter=@finito/web` works locally
- Check all dependencies are in `package.json`
- Review Railway build logs for specific errors

#### Runtime Errors
**Error**: App crashes after deployment
**Solution**:
- Check Railway logs for error details
- Verify all environment variables are set
- Ensure server-side operations don't use browser APIs

### 📊 Production Monitoring

#### Railway Dashboard Monitoring
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Application logs and errors
- **Health**: Service status and uptime
- **Deployments**: Build and deployment history

#### Application Health Indicators
- **Response Time**: Health check responds < 1s
- **Error Rate**: No 5xx errors in logs
- **Memory Usage**: Stable, no memory leaks
- **Gmail API**: Successful email operations

### 🔄 Continuous Deployment

Once initial deployment is successful:
1. **Auto-Deploy**: Railway will deploy on every push to main branch
2. **Environment Parity**: Keep dev and prod environments in sync
3. **Rollback Ready**: Railway provides one-click rollback
4. **Monitor Deployments**: Watch build and health check logs

### 📝 Final Checklist

Before marking deployment complete:
- [ ] App accessible at Railway URL
- [ ] Google OAuth login works end-to-end
- [ ] Email sync functionality operational
- [ ] Health check responding correctly
- [ ] No critical errors in logs
- [ ] Performance within acceptable limits
- [ ] Monitoring and alerting configured

### 🎉 Deployment Complete!

Your Finito Mail application is now live in production with:
- ✅ Enterprise-grade security
- ✅ Resilient Gmail API integration
- ✅ Production monitoring
- ✅ Automatic deployment pipeline
- ✅ Scalable infrastructure

---

**Need Help?** Check the deployment logs in Railway dashboard or review the [DEPLOYMENT.md](./DEPLOYMENT.md) guide for detailed troubleshooting.