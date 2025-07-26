# Environment Variables Setup Guide

## Prerequisites
- Supabase account (free tier works)
- Google Cloud Console access (for OAuth setup)
- gcloud CLI installed (for real-time sync)
- Redis instance (not Upstash, for real-time sync)

## Step 1: Supabase Authentication Setup

### 1.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings → API

### 1.2 Configure Google OAuth in Supabase
1. In Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add your Google OAuth credentials (from Step 2.2)
4. Copy the redirect URL provided by Supabase

### 1.3 Get your Supabase credentials
```env
# From Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# For server-side operations (optional)
SUPABASE_SERVICE_KEY="your-service-key"
```

## Step 2: Google OAuth Setup (for Supabase)

### 2.1 Create OAuth 2.0 Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create new OAuth 2.0 Client ID
3. Application type: Web application
4. Add authorized redirect URIs:
   - The Supabase redirect URL from Step 1.2
   - For development: `http://localhost:3000/auth/callback`
   - For production: `https://your-domain.com/auth/callback`

### 2.2 Configure OAuth Consent Screen
1. Go to OAuth consent screen
2. Add required Gmail scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `email`
   - `profile`

## Step 3: Google Cloud Project Setup (for Real-Time Sync)

### 3.1 Get your Project ID
```bash
# If you have gcloud configured:
gcloud config get-value project

# Or find it in Google Cloud Console:
# https://console.cloud.google.com/
# It's shown in the project selector dropdown
```

### 3.2 Enable Required APIs
```bash
gcloud services enable gmail.googleapis.com
gcloud services enable pubsub.googleapis.com
```

## Step 4: Create Pub/Sub Resources

### 4.1 Create the Topic
```bash
gcloud pubsub topics create gmail-push-notifications
```

### 4.2 Create the Push Subscription
```bash
# Replace YOUR_DOMAIN with your actual domain
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://YOUR_DOMAIN/api/webhooks/gmail \
  --ack-deadline=600
```

### 4.3 Grant Gmail Permission to Publish
```bash
# This allows Gmail to publish to your topic
gcloud pubsub topics add-iam-policy-binding gmail-push-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

## Step 5: Generate Verification Token

### 5.1 Generate a Secure Token
```bash
# Generate a secure random token (macOS/Linux)
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5.2 Configure Subscription with Token
```bash
# Update the subscription to include the token
gcloud pubsub subscriptions update gmail-push-sub \
  --push-endpoint=https://YOUR_DOMAIN/api/webhooks/gmail \
  --push-auth-service-account=YOUR_SERVICE_ACCOUNT_EMAIL \
  --push-auth-token-audience=https://YOUR_DOMAIN \
  --push-endpoint-attributes=x-goog-pubsub-token=YOUR_GENERATED_TOKEN
```

## Step 6: Redis Configuration

### 6.1 Redis URL (NOT Upstash)
You need a standard Redis instance that supports Pub/Sub:

**Option A: Local Development**
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine
REDIS_URL="redis://localhost:6379"
```

**Option B: Redis Cloud (Recommended for Production)**
1. Sign up at https://redis.com/try-free/
2. Create a new database
3. Get the connection string (redis://username:password@host:port)

**Option C: Railway Redis**
```bash
# Deploy Redis on Railway
railway login
railway new
railway add redis
railway up
# Get URL from Railway dashboard
```

**Option D: Other Providers**
- AWS ElastiCache
- Google Cloud Memorystore
- Azure Cache for Redis
- DigitalOcean Managed Redis

## Step 7: Other Required Variables

### 7.1 Rate Limit Bypass Token (for testing)
```bash
# Generate another secure token
RATELIMIT_BYPASS_TOKEN=$(openssl rand -base64 32)
```

### 7.2 Health Check API Key
```bash
# For production health monitoring
HEALTH_API_KEY=$(openssl rand -base64 32)
```

## Complete .env Setup

Here's your complete set of environment variables:

```env
# Supabase Authentication (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_KEY="your-service-key"  # Optional for server-side operations

# Session Security (REQUIRED)
NEXTAUTH_SECRET="generated-secure-random-secret"

# Google Cloud Configuration (for Real-Time Sync)
GCLOUD_PROJECT_ID="your-project-id-here"
GMAIL_PUBSUB_TOPIC="projects/your-project-id-here/topics/gmail-push-notifications"
PUBSUB_VERIFICATION_TOKEN="generated-token-from-step-3"

# Redis Configuration (NOT Upstash - must support Pub/Sub)
REDIS_URL="redis://username:password@host:port"

# Security Tokens
RATELIMIT_BYPASS_TOKEN="generated-token-for-testing"
HEALTH_API_KEY="generated-token-for-health-checks"

# Production URL (for OAuth redirects)
NEXT_PUBLIC_BASE_URL="https://your-domain.com"  # In production
# NEXT_PUBLIC_BASE_URL="http://localhost:3000"  # In development
```

## Verification Commands

### Check Topic Exists
```bash
gcloud pubsub topics list | grep gmail-push-notifications
```

### Check Subscription Configuration
```bash
gcloud pubsub subscriptions describe gmail-push-sub
```

### Test Redis Connection
```bash
# Using redis-cli
redis-cli -u $REDIS_URL ping
# Should return: PONG
```

## Local Development Setup

For local development with ngrok:

1. Install ngrok: https://ngrok.com/
2. Start your local server
3. Create tunnel: `ngrok http 3000`
4. Update subscription endpoint:
```bash
gcloud pubsub subscriptions update gmail-push-sub \
  --push-endpoint=https://YOUR-NGROK-URL.ngrok.io/api/webhooks/gmail
```

## Troubleshooting

### "Upstash doesn't support Pub/Sub" Error
- You MUST use a standard Redis instance, not Upstash
- Upstash uses HTTP API which doesn't support Pub/Sub commands

### Webhook Not Receiving Messages
1. Check subscription push endpoint URL
2. Verify token in headers matches env variable
3. Check Google Cloud logs:
```bash
gcloud logging read "resource.type=pubsub_subscription"
```

### Redis Connection Errors
1. Verify Redis URL format
2. Check firewall/security group rules
3. Test with redis-cli first

## Next Steps

Once you have all environment variables:
1. Add them to your `.env.local` file
2. Restart your development server
3. Test the webhook endpoint manually
4. Set up Gmail watch for a test account