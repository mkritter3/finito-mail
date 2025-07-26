#!/bin/bash

# Gmail Webhook Testing with ngrok Setup Script
# This script helps you set up ngrok for Gmail webhook testing

set -e

echo "🔧 Gmail Webhook Testing Setup"
echo "=============================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed"
    echo "Please install ngrok first: brew install ngrok"
    exit 1
fi

echo "✅ ngrok is installed"

# Check if ngrok is authenticated
if ! ngrok config check &> /dev/null; then
    echo ""
    echo "⚠️  ngrok is not authenticated"
    echo ""
    echo "Please follow these steps:"
    echo "1. Sign up for a free account at: https://dashboard.ngrok.com/signup"
    echo "2. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "3. Run: ngrok config add-authtoken YOUR_AUTHTOKEN"
    echo ""
    exit 1
fi

echo "✅ ngrok is authenticated"
echo ""

# Start ngrok
echo "🚀 Starting ngrok tunnel on port 3000..."
echo ""
echo "Once ngrok starts:"
echo "1. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)"
echo "2. Open a new terminal and run the following commands:"
echo ""
echo "   # Update your .env.local file:"
echo "   export NGROK_URL=https://YOUR-NGROK-URL.ngrok-free.app"
echo "   sed -i '' \"s|PUBSUB_AUDIENCE=.*|PUBSUB_AUDIENCE=\$NGROK_URL/api/webhooks/gmail|\" .env.local"
echo ""
echo "   # Update Google Cloud Pub/Sub subscription:"
echo "   gcloud pubsub subscriptions update gmail-push-subscription \\"
echo "     --push-endpoint=\"\$NGROK_URL/api/webhooks/gmail\" \\"
echo "     --push-auth-service-account=gmail-pubsub@YOUR_PROJECT_ID.iam.gserviceaccount.com \\"
echo "     --push-auth-token-audience=\"\$NGROK_URL/api/webhooks/gmail\""
echo ""
echo "3. Visit http://127.0.0.1:4040 to access the ngrok inspector"
echo "4. Run tests with: node scripts/test-webhook.js all"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

# Start ngrok
ngrok http 3000