#!/bin/bash

# E2E testing script for Finito Mail

set -e

echo "🧪 Setting up E2E testing environment..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
fi

# Function to check if service is running
check_service() {
    local url=$1
    local service_name=$2
    
    echo "🔍 Checking $service_name at $url..."
    
    # Try to connect to the service
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo "✅ $service_name is running"
        return 0
    else
        echo "❌ $service_name is not running at $url"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if check_service "$url" "$service_name"; then
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - waiting 2 seconds..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Start services if not running
echo "🚀 Starting services..."

# Check if services are already running
if ! check_service "http://localhost:3000" "Web App" || ! check_service "http://localhost:3001" "API Server"; then
    echo "📦 Starting development services..."
    
    # Start database if not running
    if ! docker-compose ps db | grep -q "Up"; then
        echo "🐳 Starting database..."
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
    fi
    
    # Start API and Web services in background
    echo "🚀 Starting API and Web services..."
    docker-compose up -d api web
    
    # Wait for services to be ready
    wait_for_service "http://localhost:3001" "API Server"
    wait_for_service "http://localhost:3000" "Web App"
fi

echo "✅ All services are ready!"

# Install Playwright if not installed
if ! npx playwright --version > /dev/null 2>&1; then
    echo "🎭 Installing Playwright..."
    npx playwright install
fi

# Run E2E tests
echo "🧪 Running E2E tests..."

# Run tests with different options based on arguments
case "${1:-}" in
    --ui)
        echo "🎮 Running tests in UI mode..."
        npm run test:e2e:ui
        ;;
    --headed)
        echo "🖥️  Running tests in headed mode..."
        npm run test:e2e:headed
        ;;
    --debug)
        echo "🐛 Running tests in debug mode..."
        npm run test:e2e -- --debug
        ;;
    *)
        echo "🏃 Running tests in headless mode..."
        npm run test:e2e
        ;;
esac

echo "✅ E2E tests completed!"
echo "📊 Test reports are available in playwright-report/"