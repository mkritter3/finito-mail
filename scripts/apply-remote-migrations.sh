#!/bin/bash

# Script to help apply migrations to remote Supabase projects

set -e

echo "🚀 Finito Mail - Remote Database Migration Helper"
echo "=============================================="
echo ""

# Function to extract project ref from URL
get_project_ref() {
  echo $1 | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|'
}

# Get staging and production refs
STAGING_REF=$(get_project_ref "https://aaouupausotsxnlvpzjg.supabase.co")
PROD_REF=$(get_project_ref "https://gmbzpwronylbhffdgqyb.supabase.co")

echo "📋 Migration files to apply:"
echo ""
ls -1 migrations/*.sql | sort
echo ""

echo "🎯 Target Supabase Projects:"
echo "  - Staging: $STAGING_REF"
echo "  - Production: $PROD_REF"
echo ""

echo "📝 Instructions:"
echo ""
echo "Since Supabase requires manual SQL execution for security, please:"
echo ""
echo "1️⃣  STAGING Environment:"
echo "   Open: https://app.supabase.com/project/$STAGING_REF/sql/new"
echo ""
echo "2️⃣  PRODUCTION Environment:"
echo "   Open: https://app.supabase.com/project/$PROD_REF/sql/new"
echo ""
echo "3️⃣  For each environment, copy and run these migrations IN ORDER:"
echo ""

# List migrations with instructions
for migration in $(ls migrations/*.sql | sort); do
  echo "   📄 $(basename $migration)"
  echo "      Copy from: $migration"
  echo ""
done

echo "4️⃣  After applying all migrations, verify tables were created:"
echo "   - Check the Table Editor in Supabase Dashboard"
echo "   - Expected tables: users, google_auth_tokens, email_metadata, etc."
echo ""

# Offer to open browsers
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "🌐 Would you like to open both Supabase SQL editors now? (y/n)"
  read -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "https://app.supabase.com/project/$STAGING_REF/sql/new"
    open "https://app.supabase.com/project/$PROD_REF/sql/new"
    echo "✅ Opened both SQL editors in your browser"
  fi
fi

echo ""
echo "💡 Pro tip: Apply to staging first, test, then apply to production"
echo ""
echo "⚠️  Note: Some migrations may show errors for existing objects - this is normal"
echo "    if you're re-running migrations. The important thing is that all tables exist."