#!/bin/bash
# Railway build script to avoid cache conflicts

set -e

echo "🚀 Starting Railway build..."

# Clean up any existing build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf node_modules
rm -rf .turbo
rm -rf apps/web/.next
rm -rf apps/api/.next

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --force

# Build the web app
echo "🔨 Building @finito/web..."
npx turbo build --filter=@finito/web --no-cache --no-daemon

echo "✅ Build complete!"