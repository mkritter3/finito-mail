# Gmail Webhook Testing Guide

## Overview

This guide covers comprehensive testing of Gmail webhook functionality using ngrok for local development. This is Priority #1 in our production readiness roadmap.

## Prerequisites

1. **ngrok Account**: Sign up at https://dashboard.ngrok.com/signup
2. **ngrok Authtoken**: Get from https://dashboard.ngrok.com/get-started/your-authtoken
3. **Google Cloud Project**: With Pub/Sub API enabled
4. **Redis Running**: For event processing
5. **Sentry Configured**: For error tracking

## Setup Instructions

### 1. Configure ngrok

```bash
# Install ngrok (if not already installed)
brew install ngrok

# Authenticate ngrok
ngrok config add-authtoken YOUR_AUTHTOKEN

# Start ngrok tunnel
ngrok http 3000
```

### 2. Update Environment Variables

Update `.env.local` with your ngrok URL:

```bash
PUBSUB_AUDIENCE="https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/gmail"
```

### 3. Configure Google Cloud Pub/Sub

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Update the push subscription with ngrok URL
gcloud pubsub subscriptions update gmail-push-subscription \
  --push-endpoint="https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/gmail" \
  --push-auth-service-account=gmail-pubsub@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --push-auth-token-audience="https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/gmail"
```

## Test Scenarios

### A. Happy Path Tests (Core Functionality)

#### A1: New Email Arrival
**Goal**: Verify new emails are processed and synced in <5s

```bash
# Monitor tools
# Terminal 1: ngrok inspector at http://127.0.0.1:4040
# Terminal 2: redis-cli MONITOR
# Terminal 3: Application logs

# Test steps:
1. Send test email to your Gmail account
2. Observe webhook delivery in ngrok
3. Verify Redis pub/sub message
4. Check email appears in UI within 5s
5. Verify Sentry for any errors
```

#### A2: Email Read Status
**Goal**: Verify read status synchronizes correctly

```bash
# Test steps:
1. Mark email as read in Gmail web
2. Verify webhook fires
3. Check UI updates within 5s
4. Mark as unread and verify reverse sync
```

#### A3: Email Starred
**Goal**: Verify star/unstar synchronization

```bash
# Test steps:
1. Star email in Gmail
2. Verify webhook and Redis events
3. Check UI star appears
4. Unstar and verify removal
```

#### A4: Email Deleted
**Goal**: Verify deletion synchronization

```bash
# Test steps:
1. Delete email in Gmail
2. Verify webhook fires
3. Check email removed from UI
4. Test trash/permanent delete separately
```

### B. Edge Cases & Reliability Tests

#### B1: Idempotency Check
**Goal**: Verify duplicate events don't cause issues

```bash
# Use ngrok replay feature
1. Find successful webhook in ngrok inspector
2. Click "Replay" to resend same event
3. Verify no duplicate processing
4. Check Redis deduplication works
```

#### B2: Rapid-fire Events
**Goal**: Test handling of many simultaneous events

```bash
# Script to generate multiple actions quickly
1. Star/unstar 10 emails rapidly
2. Mark multiple emails as read at once
3. Verify all events process correctly
4. Check for race conditions
```

#### B3: Auth Failure
**Goal**: Test invalid authentication handling

```bash
# Modify webhook to send invalid token
1. Use curl to send webhook with bad auth
2. Verify 401 response
3. Check Sentry captures auth errors
4. Ensure no data corruption
```

#### B4: Malformed Payload
**Goal**: Test handling of invalid webhook data

```bash
# Send malformed JSON
curl -X POST https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/gmail \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data", "missing": "required fields"}'
```

#### B5: Redis Connection Failure
**Goal**: Test graceful degradation without Redis

```bash
# Stop Redis temporarily
1. brew services stop redis
2. Send webhook event
3. Verify graceful error handling
4. Check Sentry alert fires
5. Restart Redis and verify recovery
```

## Monitoring & Metrics

### ngrok Inspector (http://127.0.0.1:4040)
- Request/response details
- Timing information
- Replay capability
- Header inspection

### Redis Monitoring
```bash
# Real-time command monitoring
redis-cli MONITOR

# Check Pub/Sub channels
redis-cli PUBSUB CHANNELS

# Check specific keys
redis-cli KEYS "webhook:*"
```

### Application Logs
```bash
# Watch API logs
tail -f apps/api/logs/api.log | grep webhook

# Filter for errors
tail -f apps/api/logs/error.log
```

### Sentry Dashboard
- Error rates
- Performance metrics
- User impact
- Error grouping

## Performance Metrics

### Target Thresholds
- **E2E Latency**: <5 seconds from Gmail action to UI update
- **Webhook Processing**: <500ms
- **Redis Pub/Sub**: <50ms
- **UI Update**: <100ms after receiving event

### Measurement Commands
```bash
# Time webhook processing
time curl -X POST https://YOUR-NGROK-URL.ngrok-free.app/api/webhooks/gmail \
  -H "Content-Type: application/json" \
  -d @test-webhook.json

# Monitor Redis latency
redis-cli --latency

# Check application metrics endpoint
curl http://localhost:3000/api/metrics
```

## Troubleshooting

### Common Issues

#### ngrok Connection Refused
```bash
# Ensure app is running on port 3000
npm run dev

# Check ngrok is forwarding to correct port
ngrok http 3000
```

#### Authentication Failures
```bash
# Verify environment variables
echo $PUBSUB_AUDIENCE

# Check Google Cloud service account
gcloud iam service-accounts list
```

#### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping

# Verify Redis URL in env
echo $REDIS_URL
```

## Test Results Documentation

Create a test results file: `test-results/webhook-testing-YYYY-MM-DD.md`

```markdown
# Webhook Testing Results - [DATE]

## Environment
- ngrok URL: [URL]
- Redis Version: [VERSION]
- Node Version: [VERSION]

## Test Results

### Happy Path Tests
- [ ] A1: New Email - Time: ___ms
- [ ] A2: Read Status - Time: ___ms  
- [ ] A3: Starred - Time: ___ms
- [ ] A4: Deleted - Time: ___ms

### Edge Cases
- [ ] B1: Idempotency - Result: ___
- [ ] B2: Rapid-fire - Result: ___
- [ ] B3: Auth Failure - Result: ___
- [ ] B4: Malformed - Result: ___
- [ ] B5: Redis Down - Result: ___

## Issues Found
1. [Issue description and resolution]

## Performance Metrics
- Average E2E Latency: ___ms
- 95th Percentile: ___ms
- Error Rate: ___%
```

## Next Steps

After successful webhook testing:
1. Move to E2E test implementation (Priority #2)
2. Begin Inngest migration planning
3. Update production deployment guide
4. Create runbook for webhook monitoring

## References

- [ngrok Documentation](https://ngrok.com/docs)
- [Google Pub/Sub Push](https://cloud.google.com/pubsub/docs/push)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)