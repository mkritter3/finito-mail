#!/bin/bash

# Docker development setup script for Finito Mail

set -e

echo "🐳 Setting up Finito Mail development environment..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
    exit 1
fi

# Start database
echo "🚀 Starting database..."
docker-compose up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until docker-compose exec db pg_isready -U postgres -d finito_mail; do
    echo "Waiting for database..."
    sleep 2
done

# Run migrations
echo "🔄 Running database migrations..."
docker-compose run --rm migrate

# Start API and web services
echo "🚀 Starting API and web services..."
docker-compose up api web

echo "✅ Development environment is ready!"
echo "🌐 Web app: http://localhost:3000"
echo "🔧 API: http://localhost:3001"