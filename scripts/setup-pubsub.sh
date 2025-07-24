#!/bin/bash

# Google Cloud Pub/Sub Setup Script for Finito Mail
# Run this script to set up all required resources

set -e  # Exit on error

echo "🚀 Starting Google Cloud Pub/Sub setup for Finito Mail..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project set. Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📋 Using project: $PROJECT_ID"

# Step 1: Enable required APIs
echo ""
echo "1️⃣ Enabling required APIs..."
gcloud services enable gmail.googleapis.com --project=$PROJECT_ID
gcloud services enable pubsub.googleapis.com --project=$PROJECT_ID
echo "✅ APIs enabled"

# Step 2: Create service account
SERVICE_ACCOUNT_NAME="gmail-webhook-sa"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo ""
echo "2️⃣ Creating service account..."
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL --project=$PROJECT_ID &> /dev/null; then
    echo "✅ Service account already exists"
else
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="Gmail Webhook Service Account" \
        --project=$PROJECT_ID
    echo "✅ Service account created"
fi

# Step 3: Create Pub/Sub topic
TOPIC_NAME="gmail-push-notifications"

echo ""
echo "3️⃣ Creating Pub/Sub topic..."
if gcloud pubsub topics describe $TOPIC_NAME --project=$PROJECT_ID &> /dev/null; then
    echo "✅ Topic already exists"
else
    gcloud pubsub topics create $TOPIC_NAME --project=$PROJECT_ID
    echo "✅ Topic created"
fi

# Step 4: Grant Gmail permission to publish
echo ""
echo "4️⃣ Granting Gmail permission to publish..."
gcloud pubsub topics add-iam-policy-binding $TOPIC_NAME \
    --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
    --role="roles/pubsub.publisher" \
    --project=$PROJECT_ID
echo "✅ Gmail can now publish to your topic"

# Step 5: Generate verification token
echo ""
echo "5️⃣ Generating verification token..."
VERIFICATION_TOKEN=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "✅ Token generated"

# Step 6: Get webhook URL
echo ""
echo "6️⃣ Enter your webhook URL:"
echo "   For production: https://your-domain.com/api/webhooks/gmail"
echo "   For local dev: https://your-ngrok-url.ngrok.io/api/webhooks/gmail"
read -p "Webhook URL: " WEBHOOK_URL

# Step 7: Create push subscription
SUBSCRIPTION_NAME="gmail-push-sub"

echo ""
echo "7️⃣ Creating push subscription..."
gcloud pubsub subscriptions create $SUBSCRIPTION_NAME \
    --topic=$TOPIC_NAME \
    --push-endpoint=$WEBHOOK_URL \
    --push-auth-service-account=$SERVICE_ACCOUNT_EMAIL \
    --push-auth-token-audience=$WEBHOOK_URL \
    --ack-deadline=600 \
    --push-endpoint-attributes="x-goog-pubsub-token=$VERIFICATION_TOKEN" \
    --project=$PROJECT_ID

echo "✅ Subscription created"

# Step 8: Create service account key (optional for local dev)
echo ""
read -p "Do you want to create a service account key for local development? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    KEY_FILE="gmail-webhook-sa-key.json"
    gcloud iam service-accounts keys create $KEY_FILE \
        --iam-account=$SERVICE_ACCOUNT_EMAIL \
        --project=$PROJECT_ID
    echo "✅ Key saved to: $KEY_FILE"
    echo "⚠️  Keep this file secure and add it to .gitignore!"
fi

# Step 9: Generate .env variables
echo ""
echo "8️⃣ Environment variables for your .env.local file:"
echo ""
echo "# Google Cloud Configuration"
echo "GCLOUD_PROJECT_ID=\"$PROJECT_ID\""
echo "GMAIL_PUBSUB_TOPIC=\"projects/$PROJECT_ID/topics/$TOPIC_NAME\""
echo "PUBSUB_VERIFICATION_TOKEN=\"$VERIFICATION_TOKEN\""
echo ""
echo "# Also add these tokens:"
echo "RATELIMIT_BYPASS_TOKEN=\"$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)\""
echo "HEALTH_API_KEY=\"$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)\""

echo ""
echo "✅ Setup complete! Copy the environment variables above to your .env.local file"
echo ""
echo "📝 Next steps:"
echo "1. Add the environment variables to your .env.local"
echo "2. Set up Redis (not Upstash) for Pub/Sub"
echo "3. Configure Gmail watch for user accounts"
echo ""
echo "🔍 To verify setup:"
echo "gcloud pubsub topics list"
echo "gcloud pubsub subscriptions list"