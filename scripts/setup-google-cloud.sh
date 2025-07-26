#!/bin/bash

# Setup script for Finito Mail Google Cloud Projects
# Run this after creating your three projects

echo "🚀 Finito Mail Google Cloud Setup Script"
echo "========================================"
echo ""

# Projects to configure
PROJECTS=("finito-mail-dev" "finito-mail-staging" "finito-mail-prod")

# APIs to enable
APIS=(
    "gmail.googleapis.com"
    "pubsub.googleapis.com"
    "cloudresourcemanager.googleapis.com"
)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to setup a project
setup_project() {
    local PROJECT=$1
    echo -e "${BLUE}Setting up project: $PROJECT${NC}"
    
    # Set the project
    gcloud config set project $PROJECT
    
    # Enable APIs
    echo "  Enabling APIs..."
    for API in "${APIS[@]}"; do
        echo "    - Enabling $API"
        gcloud services enable $API --project=$PROJECT
    done
    
    # Create Pub/Sub topic
    echo "  Creating Pub/Sub topic..."
    gcloud pubsub topics create gmail-push-notifications --project=$PROJECT 2>/dev/null || echo "    Topic already exists"
    
    # Grant Gmail publishing permissions
    echo "  Granting Gmail publish permissions..."
    gcloud pubsub topics add-iam-policy-binding gmail-push-notifications \
        --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
        --role="roles/pubsub.publisher" \
        --project=$PROJECT
    
    echo -e "${GREEN}✓ Project $PROJECT setup complete!${NC}\n"
}

# Check if user is logged in
echo "Checking gcloud authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}Not logged in to gcloud. Please run:${NC}"
    echo "gcloud auth login"
    exit 1
fi

CURRENT_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
echo -e "Logged in as: ${GREEN}$CURRENT_ACCOUNT${NC}"

# Confirm before proceeding
echo ""
echo "This script will configure the following projects:"
for PROJECT in "${PROJECTS[@]}"; do
    echo "  - $PROJECT"
done
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Setup each project
for PROJECT in "${PROJECTS[@]}"; do
    setup_project $PROJECT
done

# OAuth setup instructions
echo ""
echo "=========================================="
echo "✅ API Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps for EACH project:"
echo ""
echo "1. Go to: https://console.cloud.google.com"
echo "2. Select each project from the dropdown"
echo "3. Navigate to: APIs & Services > OAuth consent screen"
echo "4. Configure:"
echo "   - User Type: External"
echo "   - App name: Finito Mail"
echo "   - User support email: welcometofinito@gmail.com"
echo "   - Developer contact: welcometofinito@gmail.com"
echo "   - Scopes: Add 'gmail.modify'"
echo ""
echo "5. Then go to: APIs & Services > Credentials"
echo "6. Create OAuth 2.0 Client ID (Web application)"
echo ""
echo "For development:"
echo "  - Name: Finito Mail Development"
echo "  - Authorized redirect URIs:"
echo "    http://localhost:3000/auth/callback"
echo "    http://localhost:54321/auth/v1/callback"
echo ""
echo "For staging:"
echo "  - Name: Finito Mail Staging"  
echo "  - Authorized redirect URIs:"
echo "    https://finito-mail-staging.up.railway.app/auth/callback"
echo "    https://<your-staging-supabase-ref>.supabase.co/auth/v1/callback"
echo ""
echo "For production:"
echo "  - Name: Finito Mail Production"
echo "  - Authorized redirect URIs:"
echo "    https://finito-mail-production.up.railway.app/auth/callback"
echo "    https://<your-prod-supabase-ref>.supabase.co/auth/v1/callback"
echo ""
echo "Save the Client ID and Client Secret for each environment!"