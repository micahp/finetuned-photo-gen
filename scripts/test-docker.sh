#!/bin/bash

# Test script for Docker setup

set -e

echo "🧪 Testing Docker setup for finetuned-photo-gen..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    echo "💡 On macOS: Open Docker Desktop application"
    exit 1
fi

echo "✅ Docker is running"

# Test build
echo "🔨 Testing Docker build..."
if docker build -t finetuned-photo-gen-test . > /dev/null 2>&1; then
    echo "✅ Docker build successful"
else
    echo "❌ Docker build failed"
    exit 1
fi

# Test health endpoint (if containers are running)
echo "🏥 Testing health endpoint..."
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Health endpoint responding"
    curl http://localhost:3000/api/health | jq .
else
    echo "⚠️  Health endpoint not available (containers may not be running)"
fi

echo ""
echo "🎉 Docker setup test completed!"
echo ""
echo "To start the application:"
echo "  Development: npm run docker:dev"
echo "  Production:  npm run docker:prod"
echo ""
echo "To stop:       npm run docker:stop"
echo "To clean up:   npm run docker:clean" 