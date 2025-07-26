#!/bin/bash

# Apply migrations to local Supabase database

set -e

echo "🔄 Applying Database Migrations to Local Supabase"
echo "=============================================="
echo ""

# Check if Supabase is running
if ! supabase status 2>/dev/null | grep -q "is running"; then
  echo "❌ Supabase is not running. Please run 'supabase start' first."
  exit 1
fi

echo "✅ Supabase is running"
echo ""

# Get the database container name
DB_CONTAINER=$(docker ps --format "table {{.Names}}" | grep "supabase_db_" | head -1)

if [ -z "$DB_CONTAINER" ]; then
  echo "❌ Could not find Supabase database container"
  exit 1
fi

echo "📦 Database container: $DB_CONTAINER"
echo ""

# Function to apply a migration
apply_migration() {
  local file=$1
  local name=$(basename $file)
  
  echo "📝 Applying migration: $name"
  
  # Use docker exec to run psql inside the database container
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$file"
  
  if [ $? -eq 0 ]; then
    echo "✅ Successfully applied: $name"
  else
    echo "❌ Failed to apply: $name"
    return 1
  fi
  echo ""
}

# Get all migration files in order
MIGRATIONS=$(ls migrations/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATIONS" ]; then
  echo "❌ No migration files found in migrations/ directory"
  exit 1
fi

echo "📋 Found $(echo "$MIGRATIONS" | wc -l | tr -d ' ') migrations to apply:"
for migration in $MIGRATIONS; do
  echo "   - $(basename $migration)"
done
echo ""

# Apply each migration
for migration in $MIGRATIONS; do
  apply_migration "$migration"
done

echo "✅ All migrations applied successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Test the application at http://localhost:3000"
echo "2. Check Supabase Studio at http://localhost:54323"
echo "3. Verify tables were created correctly"