# Google Cloud Pub/Sub OIDC Authentication Setup

This guide walks you through setting up modern OIDC JWT authentication for your Pub/Sub push subscription using the Google Cloud Console.

## Why OIDC Authentication?

Google is moving away from custom headers (`x-goog-pubsub-token`) to industry-standard OIDC JWT tokens. This provides:
- Stronger security with cryptographic signatures
- Automatic token rotation
- No need to manage shared secrets
- Better integration with Google Cloud IAM

## Prerequisites

- Google Cloud project with Pub/Sub API enabled
- Your webhook URL (e.g., `https://finito-mail-production.up.railway.app/api/webhooks/gmail`)
- Topic already created with Gmail publish permissions

## Step-by-Step Setup

### 1. Navigate to Subscription Creation

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **Pub/Sub** > **Subscriptions**
3. Click **CREATE SUBSCRIPTION**

### 2. Configure Basic Settings

1. **Subscription ID**: `gmail-push-sub`
2. **Select a Cloud Pub/Sub topic**: Choose your existing topic (e.g., `gmail-push-notifications`)
3. **Delivery type**: Select **Push**

### 3. Configure Push Endpoint

1. **Endpoint URL**: 
   ```
   https://finito-mail-production.up.railway.app/api/webhooks/gmail
   ```

2. **Enable authentication**: ✅ Check this box

3. **Service account**: Select the dropdown and choose:
   - If you see `gmail-webhook-sa@your-project.iam.gserviceaccount.com`, select it
   - Otherwise, click "Create new service account" and name it `gmail-webhook-sa`

4. **Audience**: Leave blank (it will default to your endpoint URL)

### 4. Configure Additional Settings

1. **Message retention duration**: Keep default (7 days)
2. **Acknowledgement deadline**: Set to `600` seconds (10 minutes)
3. **Subscription filter**: Leave empty
4. **Message ordering**: Not needed for Gmail notifications
5. **Dead lettering**: Optional but recommended for production

### 5. Create the Subscription

Click **CREATE** to create your subscription with OIDC authentication enabled.

## Environment Variables

Add these to your `.env.local`:

```bash
# Your production URL (used for JWT audience validation)
PUBSUB_AUDIENCE="https://finito-mail-production.up.railway.app/api/webhooks/gmail"

# For Railway deployment
RAILWAY_STATIC_URL="https://finito-mail-production.up.railway.app"

# Keep the legacy token for backward compatibility during migration
PUBSUB_VERIFICATION_TOKEN="your-existing-token"
```

## Testing the Setup

### 1. Check Subscription Configuration

```bash
gcloud pubsub subscriptions describe gmail-push-sub
```

Look for:
```yaml
pushConfig:
  pushEndpoint: https://finito-mail-production.up.railway.app/api/webhooks/gmail
  oidcToken:
    serviceAccountEmail: gmail-webhook-sa@your-project.iam.gserviceaccount.com
    audience: https://finito-mail-production.up.railway.app/api/webhooks/gmail
```

### 2. Send a Test Message

```bash
gcloud pubsub topics publish gmail-push-notifications \
  --message='{"emailAddress":"test@example.com","historyId":123456}'
```

### 3. Check Webhook Logs

Your webhook should log:
```
OIDC JWT verified successfully {
  issuer: "https://accounts.google.com",
  audience: "https://finito-mail-production.up.railway.app/api/webhooks/gmail",
  email: "gmail-webhook-sa@your-project.iam.gserviceaccount.com"
}
```

## Migration Strategy

The updated webhook code supports both authentication methods:

1. **OIDC JWT** (preferred): Checked first via `Authorization: Bearer <token>` header
2. **Legacy token** (fallback): Via custom header or query parameter

This allows you to:
1. Keep existing setup working
2. Migrate to OIDC at your own pace
3. Remove legacy code once OIDC is verified working

## Troubleshooting

### "Invalid authentication" errors

1. Verify the service account exists:
   ```bash
   gcloud iam service-accounts list
   ```

2. Check IAM permissions:
   ```bash
   gcloud projects get-iam-policy YOUR_PROJECT_ID
   ```

3. Ensure your webhook URL matches exactly (including https://)

### JWT verification failures

1. Check the audience in your subscription:
   ```bash
   gcloud pubsub subscriptions describe gmail-push-sub --format="value(pushConfig.oidcToken.audience)"
   ```

2. Verify it matches your `PUBSUB_AUDIENCE` env var

### Testing locally

For local development, you can still use ngrok with legacy token auth:
```bash
# In query parameter
https://your-ngrok-url.ngrok.io/api/webhooks/gmail?token=your-verification-token
```

## Security Benefits

With OIDC authentication:
- Google cryptographically signs each request
- Tokens expire and rotate automatically
- No shared secrets in your codebase
- Integration with Google Cloud IAM for access control
- Protection against replay attacks

## Next Steps

1. Monitor webhook logs to ensure OIDC authentication is working
2. Once stable, consider removing legacy token support
3. Set up dead letter queues for failed messages
4. Configure alerting for authentication failures