#!/bin/bash

# Google Cloud Pub/Sub Setup Script with OIDC Authentication
# Modern approach using JWT tokens instead of custom headers

set -e  # Exit on error

echo "🚀 Starting Google Cloud Pub/Sub setup with OIDC authentication..."

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
gcloud services enable iam.googleapis.com --project=$PROJECT_ID
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

# Step 3: Grant necessary roles to service account
echo ""
echo "3️⃣ Granting IAM roles to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/pubsub.subscriber" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/iam.serviceAccountTokenCreator" \
    --condition=None

echo "✅ IAM roles granted"

# Step 4: Create Pub/Sub topic
TOPIC_NAME="gmail-push-notifications"

echo ""
echo "4️⃣ Creating Pub/Sub topic..."
if gcloud pubsub topics describe $TOPIC_NAME --project=$PROJECT_ID &> /dev/null; then
    echo "✅ Topic already exists"
else
    gcloud pubsub topics create $TOPIC_NAME --project=$PROJECT_ID
    echo "✅ Topic created"
fi

# Step 5: Grant Gmail permission to publish
echo ""
echo "5️⃣ Granting Gmail permission to publish..."
gcloud pubsub topics add-iam-policy-binding $TOPIC_NAME \
    --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
    --role="roles/pubsub.publisher" \
    --project=$PROJECT_ID
echo "✅ Gmail can now publish to your topic"

# Step 6: Get webhook URL
echo ""
echo "6️⃣ Enter your webhook URL:"
echo "   For Railway: https://finito-mail-production.up.railway.app/api/webhooks/gmail"
echo "   For local dev: https://your-ngrok-url.ngrok.io/api/webhooks/gmail"
read -p "Webhook URL: " WEBHOOK_URL

# Step 7: Create push subscription with OIDC
SUBSCRIPTION_NAME="gmail-push-sub"

echo ""
echo "7️⃣ Creating push subscription with OIDC authentication..."

# Delete existing subscription if it exists
if gcloud pubsub subscriptions describe $SUBSCRIPTION_NAME --project=$PROJECT_ID &> /dev/null; then
    echo "⚠️  Deleting existing subscription..."
    gcloud pubsub subscriptions delete $SUBSCRIPTION_NAME --project=$PROJECT_ID --quiet
fi

# Create new subscription with OIDC
gcloud pubsub subscriptions create $SUBSCRIPTION_NAME \
    --topic=$TOPIC_NAME \
    --push-endpoint=$WEBHOOK_URL \
    --push-auth-service-account=$SERVICE_ACCOUNT_EMAIL \
    --push-auth-token-audience=$WEBHOOK_URL \
    --ack-deadline=600 \
    --project=$PROJECT_ID

echo "✅ Subscription created with OIDC authentication"

# Step 8: Generate legacy token for backward compatibility
echo ""
echo "8️⃣ Generating legacy verification token (for migration period)..."
VERIFICATION_TOKEN=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "✅ Token generated"

# Step 9: Generate .env variables
echo ""
echo "9️⃣ Environment variables for your .env.local file:"
echo ""
echo "# Google Cloud Configuration"
echo "GCLOUD_PROJECT_ID=\"$PROJECT_ID\""
echo "GMAIL_PUBSUB_TOPIC=\"projects/$PROJECT_ID/topics/$TOPIC_NAME\""
echo ""
echo "# OIDC Authentication (modern approach)"
echo "PUBSUB_AUDIENCE=\"$WEBHOOK_URL\""
echo ""
echo "# Legacy token (for backward compatibility)"
echo "PUBSUB_VERIFICATION_TOKEN=\"$VERIFICATION_TOKEN\""
echo ""
echo "# Additional security tokens"
echo "RATELIMIT_BYPASS_TOKEN=\"$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)\""
echo "HEALTH_API_KEY=\"$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)\""

echo ""
echo "✅ Setup complete with OIDC authentication!"
echo ""
echo "📝 Next steps:"
echo "1. Add the environment variables to your .env.local"
echo "2. Deploy your webhook code with OIDC support"
echo "3. Test with: gcloud pubsub topics publish $TOPIC_NAME --message='{\"test\":true}'"
echo ""
echo "🔒 Security notes:"
echo "- OIDC tokens are automatically managed by Google"
echo "- No shared secrets needed in production"
echo "- Legacy token provided for migration period only"
echo ""
echo "🔍 To verify setup:"
echo "gcloud pubsub subscriptions describe $SUBSCRIPTION_NAME"
echo ""
echo "Look for the 'oidcToken' section in the output"