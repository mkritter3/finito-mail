#!/bin/bash

# Start ngrok for local webhook testing
# This creates a public URL that forwards to your local development server

echo "🌐 Starting ngrok for local webhook testing..."
echo "This will create a public URL that forwards to http://localhost:3000"
echo ""

# Start ngrok on port 3000 (where the web app runs)
ngrok http 3000 --log stdout

# Note: After starting ngrok, you'll need to:
# 1. Copy the HTTPS URL from ngrok (e.g., https://abc123.ngrok.io)
# 2. Update your Google Cloud Pub/Sub push subscription endpoint to:
#    https://YOUR_NGROK_URL/api/webhooks/gmail
# 3. Update NEXTAUTH_URL in .env.local to your ngrok URL
# 4. Add the ngrok URL to your Google OAuth redirect URIs