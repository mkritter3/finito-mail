# Environment Variables Setup Guide for Real-Time Sync

## Prerequisites
- Google Cloud Console access
- gcloud CLI installed
- Redis instance (not Upstash)

## Step 1: Google Cloud Project Setup

### 1.1 Get your Project ID
```bash
# If you have gcloud configured:
gcloud config get-value project

# Or find it in Google Cloud Console:
# https://console.cloud.google.com/
# It's shown in the project selector dropdown
```

### 1.2 Enable Required APIs
```bash
gcloud services enable gmail.googleapis.com
gcloud services enable pubsub.googleapis.com
```

## Step 2: Create Pub/Sub Resources

### 2.1 Create the Topic
```bash
gcloud pubsub topics create gmail-push-notifications
```

### 2.2 Create the Push Subscription
```bash
# Replace YOUR_DOMAIN with your actual domain
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://YOUR_DOMAIN/api/webhooks/gmail \
  --ack-deadline=600
```

### 2.3 Grant Gmail Permission to Publish
```bash
# This allows Gmail to publish to your topic
gcloud pubsub topics add-iam-policy-binding gmail-push-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

## Step 3: Generate Verification Token

### 3.1 Generate a Secure Token
```bash
# Generate a secure random token (macOS/Linux)
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3.2 Configure Subscription with Token
```bash
# Update the subscription to include the token
gcloud pubsub subscriptions update gmail-push-sub \
  --push-endpoint=https://YOUR_DOMAIN/api/webhooks/gmail \
  --push-auth-service-account=YOUR_SERVICE_ACCOUNT_EMAIL \
  --push-auth-token-audience=https://YOUR_DOMAIN \
  --push-endpoint-attributes=x-goog-pubsub-token=YOUR_GENERATED_TOKEN
```

## Step 4: Redis Configuration

### 4.1 Redis URL (NOT Upstash)
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

## Step 5: Other Required Variables

### 5.1 Rate Limit Bypass Token (for testing)
```bash
# Generate another secure token
RATELIMIT_BYPASS_TOKEN=$(openssl rand -base64 32)
```

### 5.2 Health Check API Key
```bash
# For production health monitoring
HEALTH_API_KEY=$(openssl rand -base64 32)
```

## Complete .env Setup

Here's your complete set of environment variables:

```env
# Google Cloud Configuration
GCLOUD_PROJECT_ID="your-project-id-here"
GMAIL_PUBSUB_TOPIC="projects/your-project-id-here/topics/gmail-push-notifications"
PUBSUB_VERIFICATION_TOKEN="generated-token-from-step-3"

# Redis Configuration (NOT Upstash - must support Pub/Sub)
REDIS_URL="redis://username:password@host:port"

# Security Tokens
RATELIMIT_BYPASS_TOKEN="generated-token-for-testing"
HEALTH_API_KEY="generated-token-for-health-checks"

# Existing Google OAuth (you should already have these)
GOOGLE_CLIENT_ID="your-existing-client-id"
GOOGLE_CLIENT_SECRET="your-existing-client-secret"
GOOGLE_REDIRECT_URI="https://your-domain.com/api/auth/callback/google"
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