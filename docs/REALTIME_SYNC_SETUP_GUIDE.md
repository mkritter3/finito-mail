# 🚀 Real-Time Sync Setup Guide

This guide walks you through setting up Gmail Push Notifications for real-time email sync in Finito Mail.

## 📋 Prerequisites

- Google Cloud Project with billing enabled
- Gmail API enabled in your project
- Google Cloud CLI (`gcloud`) installed
- Production domain with HTTPS (for webhook endpoint)

## 🔧 Step-by-Step Setup

### Step 1: Install Google Cloud CLI

```bash
# macOS
brew install google-cloud-sdk

# Initialize and authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Step 2: Enable Required APIs

```bash
# Enable Pub/Sub and Gmail APIs
gcloud services enable pubsub.googleapis.com
gcloud services enable gmail.googleapis.com
```

### Step 3: Create Pub/Sub Topic

```bash
# Create the topic for Gmail notifications
gcloud pubsub topics create gmail-push-notifications

# Verify topic was created
gcloud pubsub topics list
```

### Step 4: Create Pub/Sub Subscription

```bash
# Create push subscription to your webhook
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://your-domain.com/api/webhooks/gmail \
  --ack-deadline=10

# For local development with ngrok
# gcloud pubsub subscriptions create gmail-push-sub-dev \
#   --topic=gmail-push-notifications \
#   --push-endpoint=https://YOUR-NGROK-ID.ngrok.io/api/webhooks/gmail \
#   --ack-deadline=10
```

### Step 5: Grant Gmail Permission to Publish

```bash
# Get the Gmail service account
GMAIL_SERVICE_ACCOUNT="gmail-api-push@system.gserviceaccount.com"

# Grant publish permission to Gmail
gcloud pubsub topics add-iam-policy-binding gmail-push-notifications \
  --member="serviceAccount:${GMAIL_SERVICE_ACCOUNT}" \
  --role="roles/pubsub.publisher"
```

### Step 6: Generate Verification Token

```bash
# Generate a secure random token
openssl rand -base64 32

# Save this token - you'll need it for the environment variable
```

### Step 7: Update Environment Variables

Add these to your `.env.local` file:

```env
# Pub/Sub Configuration
PUBSUB_VERIFICATION_TOKEN=your-generated-token-from-step-6
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-push-notifications

# Google Cloud Configuration
GCLOUD_PROJECT_ID=your-project-id
```

### Step 8: Update Database Schema

Run these Prisma migrations to add the required tables:

```prisma
// Add to your schema.prisma

model GmailWatch {
  id          String   @id @default(cuid())
  userId      String   @unique
  historyId   String
  expiration  DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SyncStatus {
  id             String   @id @default(cuid())
  userId         String   @unique
  lastHistoryId  String?
  lastSyncedAt   DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Then run:

```bash
npx prisma generate
npx prisma db push
```

### Step 9: Configure Webhook Security (Production)

For production, configure Pub/Sub to include a verification token:

```bash
# Update subscription with token
gcloud pubsub subscriptions modify-push-config gmail-push-sub \
  --push-endpoint=https://your-domain.com/api/webhooks/gmail \
  --push-auth-service-account=YOUR_SERVICE_ACCOUNT_EMAIL \
  --push-auth-token-audience=https://your-domain.com
```

### Step 10: Test the Setup

1. **Register Gmail Watch** (in your app):
   ```bash
   curl -X POST https://your-domain.com/api/gmail/watch \
     -H "Cookie: your-session-cookie"
   ```

2. **Check Watch Status**:
   ```bash
   curl https://your-domain.com/api/gmail/watch \
     -H "Cookie: your-session-cookie"
   ```

3. **Send Test Email**: Send an email to the authenticated account

4. **Monitor Logs**: Check your application logs for webhook activity

## 🧪 Local Development Testing

### Using ngrok for Local Webhooks

```bash
# Install ngrok
brew install ngrok

# Start your local server
npm run dev

# In another terminal, create tunnel
ngrok http 3000

# Update Pub/Sub subscription with ngrok URL
gcloud pubsub subscriptions modify-push-config gmail-push-sub-dev \
  --push-endpoint=https://YOUR-NGROK-ID.ngrok.io/api/webhooks/gmail
```

### Testing SSE Connection

```javascript
// Test SSE in browser console
const eventSource = new EventSource('/api/sse/email-updates');

eventSource.onmessage = (event) => {
  console.log('SSE message:', JSON.parse(event.data));
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};

// Clean up when done
eventSource.close();
```

## 🔍 Troubleshooting

### Common Issues

1. **"Permission denied" when creating topic**
   - Ensure billing is enabled on your Google Cloud project
   - Check you have the necessary IAM permissions

2. **Webhook not receiving notifications**
   - Verify the endpoint URL is publicly accessible
   - Check Pub/Sub subscription logs in Google Cloud Console
   - Ensure verification token matches

3. **SSE connection dropping**
   - Check for proxy/load balancer timeouts
   - Verify heartbeat is working (30s intervals)
   - Check browser developer console for errors

4. **Gmail watch expires quickly**
   - Normal - Gmail watches expire after 7 days max
   - The app automatically renews before expiration
   - Check `/api/gmail/watch` status endpoint

### Debugging Commands

```bash
# View Pub/Sub subscription details
gcloud pubsub subscriptions describe gmail-push-sub

# Check topic permissions
gcloud pubsub topics get-iam-policy gmail-push-notifications

# Test Pub/Sub manually
gcloud pubsub topics publish gmail-push-notifications \
  --message='{"emailAddress":"test@gmail.com","historyId":"12345"}'

# View subscription metrics
gcloud monitoring metrics list --filter="resource.type=pubsub_subscription"
```

## 📊 Monitoring

### Key Metrics to Track

1. **Webhook Performance**
   - Response time (should be <1s)
   - Success rate (target >99.9%)
   - Queue depth

2. **SSE Connections**
   - Active connections count
   - Connection duration
   - Reconnection frequency

3. **Gmail API Usage**
   - History.list calls per minute
   - Quota usage percentage
   - Error rates

### Sentry Dashboard

The monitoring setup automatically tracks:
- Webhook processing time
- SSE connection health
- Gmail sync latency
- Real-time update delivery time

## 🚀 Production Checklist

- [ ] Google Cloud project configured
- [ ] Pub/Sub topic and subscription created
- [ ] Gmail publish permissions granted
- [ ] Environment variables set
- [ ] Database schema updated
- [ ] HTTPS endpoint available
- [ ] Verification token secured
- [ ] Monitoring alerts configured
- [ ] Error handling tested
- [ ] Fallback polling verified

## 📚 Additional Resources

- [Gmail Push Notifications Guide](https://developers.google.com/gmail/api/guides/push)
- [Google Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Server-Sent Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Finito Mail Real-Time Sync Architecture](./REAL_TIME_SYNC_IMPLEMENTATION.md)

---

**Note**: Real-time sync significantly improves user experience and reduces API quota usage compared to polling. The implementation includes automatic fallback to polling if real-time sync fails, ensuring reliability.