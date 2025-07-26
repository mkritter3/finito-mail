# 🚀 Three-Environment Setup Guide for Finito Mail

**Last Updated: 2025-01-25**

This guide explains why we use three separate environments (Development, Staging, Production) and provides step-by-step instructions for setting them up for Finito Mail.

## 📋 Table of Contents

1. [Overview: Why Three Environments?](#overview-why-three-environments)
2. [Environment Comparison](#environment-comparison)
3. [Prerequisites](#prerequisites)
4. [Step 1: Create Google Cloud Projects](#step-1-create-google-cloud-projects)
5. [Step 2: Create Supabase Projects](#step-2-create-supabase-projects)
6. [Step 3: Set Up Redis Instances](#step-3-set-up-redis-instances)
7. [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
8. [Step 5: Set Up Deployment Pipeline](#step-5-set-up-deployment-pipeline)
9. [Testing Strategy](#testing-strategy)
10. [Common Issues & Solutions](#common-issues--solutions)

## Overview: Why Three Environments?

### The Car Manufacturing Analogy

Think of building Finito Mail like manufacturing a car:

- **Development** = The Workshop 🔧
  - Where you build and test individual parts
  - Messy, experimental, frequently broken
  - Only on your local machine

- **Staging** = The Test Track 🏁
  - Where you test the fully assembled car
  - Mimics real-world conditions exactly
  - Catches integration issues before customers

- **Production** = The Showroom & Open Road 🚗
  - What your customers actually use
  - Must be pristine, reliable, secure
  - No experiments allowed

### Why Not Just Dev + Prod?

Staging catches critical issues that local development cannot:
- ❌ Incorrect environment variables in deployment
- ❌ SSL certificate problems with webhooks
- ❌ Database migration failures on real data
- ❌ OAuth redirect URI misconfigurations
- ❌ Redis Pub/Sub connection issues
- ❌ Performance problems at scale

**For Finito Mail specifically**: You're handling sensitive email data with complex real-time integrations. A production failure could mean lost emails or broken sync. Staging is your safety net.

## Environment Comparison

| Aspect | Development | Staging | Production |
|--------|------------|---------|------------|
| **URL** | `http://localhost:3000` | `https://staging.finito.mail` | `https://app.finito.mail` |
| **Purpose** | Build features | Test deployments | Serve users |
| **Data** | Mock/test data | Beta tester data | Real user data |
| **Users** | Just you | You + beta testers | All customers |
| **Supabase** | Local CLI instance | Hosted (free tier) | Hosted (paid plan) |
| **Redis** | Local Docker | Hosted (free tier) | Hosted (production) |
| **Webhooks** | ngrok tunnel | Real domain | Real domain |
| **Stability** | Often broken | Should be stable | Must be stable |
| **Experiments** | Yes! | Limited | Never |

## Prerequisites

Before starting, ensure you have:

- [ ] Google account for Google Cloud Console
- [ ] Supabase account
- [ ] Domain name (for staging & production)
- [ ] Hosting account (Vercel recommended)
- [ ] Local development tools:
  - Node.js 18+
  - Docker (for local Redis)
  - ngrok account (for webhook testing)
  - Supabase CLI

## Step 1: Create Google Cloud Projects

We need THREE separate Google Cloud projects for proper webhook domain verification.

### 1.1 Create Projects

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create three new projects:
   - `finito-mail-dev`
   - `finito-mail-staging`
   - `finito-mail-prod`

### 1.2 Enable APIs (for each project)

```bash
# For each project, enable required APIs
gcloud config set project finito-mail-dev  # (then staging, then prod)
gcloud services enable gmail.googleapis.com
gcloud services enable pubsub.googleapis.com
```

### 1.3 Create OAuth Credentials (for each project)

1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Choose **Web application**
4. Configure for each environment:

**Development:**
```
Name: Finito Mail Development
Authorized redirect URIs:
- http://localhost:3000/auth/callback
- http://localhost:3000/api/auth/callback/google
- http://localhost:54321/auth/v1/callback (Supabase local)
```

**Staging:**
```
Name: Finito Mail Staging
Authorized redirect URIs:
- https://staging.finito.mail/auth/callback
- https://staging.finito.mail/api/auth/callback/google
- https://<your-staging-supabase-ref>.supabase.co/auth/v1/callback
```

**Production:**
```
Name: Finito Mail Production
Authorized redirect URIs:
- https://app.finito.mail/auth/callback
- https://app.finito.mail/api/auth/callback/google
- https://<your-prod-supabase-ref>.supabase.co/auth/v1/callback
```

### 1.4 Set Up Pub/Sub Topics (for each project)

```bash
# Create topic for Gmail push notifications
gcloud pubsub topics create gmail-push-notifications

# Create subscription (different for each environment)
# Development (will use ngrok URL)
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://YOUR-NGROK-ID.ngrok.io/api/webhooks/gmail

# Staging
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://staging.finito.mail/api/webhooks/gmail

# Production
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://app.finito.mail/api/webhooks/gmail
```

### 1.5 Domain Verification

For staging and production:

1. Go to **APIs & Services > Domain verification**
2. Add and verify your domains:
   - Staging: `staging.finito.mail`
   - Production: `app.finito.mail`
3. Follow Google's verification process (usually adding a TXT record to DNS)

## Step 2: Create Supabase Projects

### 2.1 Create Three Projects

1. Log into [Supabase Dashboard](https://app.supabase.com)
2. Create three projects:
   - `finito-mail-dev`
   - `finito-mail-staging`
   - `finito-mail-prod`

### 2.2 Configure Auth Providers (for each project)

1. Go to **Authentication > Providers**
2. Enable **Google** provider
3. Add the OAuth credentials from Step 1.3:
   - Client ID: `<from Google Cloud>`
   - Client Secret: `<from Google Cloud>`

### 2.3 Apply Database Migrations

```bash
# Link to development project first
supabase link --project-ref <your-dev-project-ref>

# Apply existing migrations
supabase db push

# For staging and production, you'll apply migrations through CI/CD
```

### 2.4 Configure Redirect URLs

In each Supabase project, go to **Authentication > URL Configuration** and set:

**Development:**
```
Site URL: http://localhost:3000
Redirect URLs:
- http://localhost:3000/**
```

**Staging:**
```
Site URL: https://staging.finito.mail
Redirect URLs:
- https://staging.finito.mail/**
```

**Production:**
```
Site URL: https://app.finito.mail
Redirect URLs:
- https://app.finito.mail/**
```

## Step 3: Set Up Redis Instances

Redis is required for real-time sync. **IMPORTANT**: Must use standard Redis, NOT Upstash (no Pub/Sub support).

### 3.1 Development Redis

```bash
# Using Docker
docker run -d --name redis-dev -p 6379:6379 redis:alpine

# Or using Homebrew (macOS)
brew install redis
brew services start redis
```

### 3.2 Staging Redis

Use [Redis Cloud](https://redis.com/try-free/) free tier:
1. Create new database
2. Note the connection string
3. Ensure Pub/Sub is enabled

### 3.3 Production Redis

Options:
- Redis Cloud (paid tier)
- Railway Redis
- AWS ElastiCache
- Google Cloud Memorystore

## Step 4: Configure Environment Variables

### 4.1 Create Environment Files

Create three files (never commit these!):

**.env.development**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-local-supabase>
SUPABASE_SERVICE_ROLE_KEY=<from-local-supabase>

# Google OAuth
GOOGLE_CLIENT_ID=<dev-client-id>
GOOGLE_CLIENT_SECRET=<dev-client-secret>

# Redis
REDIS_URL=redis://localhost:6379

# Gmail Pub/Sub
GMAIL_PUBSUB_TOPIC=projects/finito-mail-dev/topics/gmail-push-notifications
PUBSUB_VERIFICATION_TOKEN=<generate-random-token>

# Monitoring (optional for dev)
SENTRY_DSN=<your-sentry-dsn>

# Security
NEXTAUTH_SECRET=<generate-random-secret>
NEXTAUTH_URL=http://localhost:3000
```

**.env.staging**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-key>

# Google OAuth
GOOGLE_CLIENT_ID=<staging-client-id>
GOOGLE_CLIENT_SECRET=<staging-client-secret>

# Redis
REDIS_URL=redis://username:password@redis-staging.example.com:6379

# Gmail Pub/Sub
GMAIL_PUBSUB_TOPIC=projects/finito-mail-staging/topics/gmail-push-notifications
PUBSUB_VERIFICATION_TOKEN=<generate-different-token>

# Monitoring
SENTRY_DSN=<your-sentry-dsn>
SENTRY_ENVIRONMENT=staging

# Security
NEXTAUTH_SECRET=<generate-different-secret>
NEXTAUTH_URL=https://staging.finito.mail
```

**.env.production**
```bash
# Same structure as staging, but with production values
# Store these securely in your deployment platform
```

### 4.2 Generate Secure Tokens

```bash
# Generate random tokens/secrets
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -base64 32  # For PUBSUB_VERIFICATION_TOKEN
```

## Step 5: Set Up Deployment Pipeline

### 5.1 Railway Setup

1. **Create Railway account** at [railway.app](https://railway.app)
2. **Create two projects**:
   - `finito-mail-staging`
   - `finito-mail-production`

3. **For each project**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Link repository (in project directory)
   railway link
   ```

4. **Configure environment variables** in Railway dashboard
5. **Set up deployments**:
   - Production project: Deploy from `main` branch
   - Staging project: Deploy from `staging` branch

### 5.2 GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Environments

on:
  push:
    branches: [main, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set environment
        run: |
          if [[ ${{ github.ref }} == 'refs/heads/main' ]]; then
            echo "ENVIRONMENT=production" >> $GITHUB_ENV
          else
            echo "ENVIRONMENT=staging" >> $GITHUB_ENV
          fi
      
      - name: Run tests
        run: |
          npm install
          npm run test
          npm run lint
          npm run type-check
      
      - name: Deploy to Railway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          npm install -g @railway/cli
          if [[ $ENVIRONMENT == 'production' ]]; then
            railway up --environment production
          else
            railway up --environment staging
          fi
```

## Testing Strategy

### Development Testing

```bash
# 1. Start local services
docker run -d -p 6379:6379 redis:alpine
supabase start

# 2. Start ngrok for webhooks
ngrok http 3000

# 3. Update Google Pub/Sub subscription with ngrok URL
gcloud pubsub subscriptions update gmail-push-sub \
  --push-endpoint=https://YOUR-NGROK-ID.ngrok.io/api/webhooks/gmail

# 4. Start development server
npm run dev

# 5. Test with your personal Gmail account
```

### Staging Testing

1. **Deploy to staging**: `git push origin staging`
2. **Use test Gmail account**: `finito-mail-test@gmail.com`
3. **Run E2E tests**:
   ```bash
   PLAYWRIGHT_BASE_URL=https://staging.finito.mail npm run test:e2e
   ```
4. **Test critical flows**:
   - OAuth login/logout
   - Email sync
   - Real-time updates via webhook
   - Send/reply/forward emails

### Production Deployment Checklist

- [ ] All tests passing in staging
- [ ] E2E tests complete
- [ ] Performance metrics acceptable
- [ ] Security scan complete
- [ ] Database migrations tested
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured

## Common Issues & Solutions

### Issue: "Webhook not receiving notifications"

**Development:**
- Ensure ngrok is running and URL is updated in Pub/Sub
- Check `PUBSUB_VERIFICATION_TOKEN` matches

**Staging/Production:**
- Verify domain in Google Cloud Console
- Check SSL certificate is valid
- Ensure webhook endpoint returns 200 OK

### Issue: "OAuth redirect mismatch"

- Exact match required (including trailing slashes)
- Update in both Google Cloud Console AND Supabase
- Wait 5-10 minutes for changes to propagate

### Issue: "Redis Pub/Sub not working"

- Confirm NOT using Upstash (doesn't support Pub/Sub)
- Check Redis connection string format
- Verify Redis version supports Pub/Sub (Redis 2.0+)

### Issue: "Different behavior in staging vs dev"

- Compare environment variables carefully
- Check for hardcoded localhost references
- Verify all services are same versions
- Review server logs for configuration errors

## Summary

The three-environment setup provides:

1. **Safety**: Test everything in staging before production
2. **Isolation**: Dev mistakes can't affect real users
3. **Confidence**: Know your deployments will work
4. **Professionalism**: Industry-standard practice

Yes, it's more setup work initially, but it prevents catastrophic production failures and protects your users' sensitive email data.

---

**Next Steps:**
1. Start with creating the Google Cloud projects
2. Set up your development environment first
3. Get the basic flow working locally
4. Then replicate to staging
5. Finally, configure production when ready to launch

Remember: The staging environment is your safety net. Use it!