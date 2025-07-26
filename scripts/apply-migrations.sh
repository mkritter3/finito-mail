#!/bin/bash

# Apply all database migrations to Supabase
# This script can be used for local, staging, or production environments

set -e

echo "🔄 Applying Database Migrations to Supabase"
echo "=========================================="
echo ""

# Check if environment is specified
ENV=${1:-local}

case $ENV in
  local)
    echo "📍 Environment: Local Development"
    export $(grep -v '^#' .env.local | xargs)
    ;;
  staging)
    echo "📍 Environment: Staging"
    export $(grep -v '^#' .env.staging | xargs)
    ;;
  production)
    echo "📍 Environment: Production"
    export $(grep -v '^#' .env.production | xargs)
    ;;
  *)
    echo "❌ Invalid environment: $ENV"
    echo "Usage: $0 [local|staging|production]"
    exit 1
    ;;
esac

# Extract project reference from Supabase URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

if [ "$ENV" = "local" ]; then
  PROJECT_REF="localhost:54321"
fi

echo "🔗 Supabase Project: $PROJECT_REF"
echo ""

# Function to apply a migration
apply_migration() {
  local file=$1
  local name=$(basename $file)
  
  echo "📝 Applying migration: $name"
  
  if [ "$ENV" = "local" ]; then
    # For local development, use Supabase CLI
    supabase db execute -f "$file" --local
  else
    # For remote environments, we need to use Supabase Management API
    echo "⚠️  Remote migrations require manual execution"
    echo "   Please copy the SQL from: $file"
    echo "   And run it in: https://app.supabase.com/project/$PROJECT_REF/sql/new"
  fi
}

# Check if migrations directory exists
if [ ! -d "migrations" ]; then
  echo "❌ Migrations directory not found"
  exit 1
fi

# Get all migration files in order
MIGRATIONS=$(ls migrations/*.sql | sort)

echo "📋 Found $(echo "$MIGRATIONS" | wc -l | tr -d ' ') migrations"
echo ""

if [ "$ENV" = "local" ]; then
  # For local development, apply all migrations
  for migration in $MIGRATIONS; do
    apply_migration "$migration"
  done
  
  echo ""
  echo "✅ All migrations applied successfully!"
else
  # For remote environments, provide instructions
  echo "📋 Please apply these migrations in order:"
  echo ""
  
  for migration in $MIGRATIONS; do
    echo "   - $(basename $migration)"
  done
  
  echo ""
  echo "🔗 Supabase SQL Editor: https://app.supabase.com/project/$PROJECT_REF/sql/new"
  echo ""
  echo "📝 Instructions:"
  echo "1. Open each migration file in the migrations/ directory"
  echo "2. Copy the SQL content"
  echo "3. Paste and run in the Supabase SQL Editor"
  echo "4. Apply them in numerical order (001, 004, 005, etc.)"
  
  # Optionally open the SQL editor
  if [ "$(uname)" = "Darwin" ]; then
    echo ""
    read -p "Would you like to open the Supabase SQL Editor? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      open "https://app.supabase.com/project/$PROJECT_REF/sql/new"
    fi
  fi
fi

echo ""
echo "📝 Next steps:"
echo "1. Verify migrations with: node scripts/verify-migration.js"
echo "2. Test the application"
echo "3. Check for any migration errors in the logs"