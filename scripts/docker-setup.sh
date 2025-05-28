#!/bin/bash

# Docker setup script for finetuned-photo-gen

set -e

echo "🐳 Setting up Docker environment for finetuned-photo-gen..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Function to run development environment
dev() {
    echo "🚀 Starting development environment..."
    docker-compose -f docker-compose.dev.yml up --build
}

# Function to run production environment
prod() {
    echo "🚀 Starting production environment..."
    docker-compose up --build -d
    echo "✅ Production environment started!"
    echo "📱 App: http://localhost:3000"
    echo "🗄️  Database: localhost:5432"
}

# Function to stop all services
stop() {
    echo "🛑 Stopping all services..."
    docker-compose down
    docker-compose -f docker-compose.dev.yml down
}

# Function to clean up
clean() {
    echo "🧹 Cleaning up Docker resources..."
    docker-compose down -v
    docker-compose -f docker-compose.dev.yml down -v
    docker system prune -f
}

# Function to run database migrations
migrate() {
    echo "🔄 Running database migrations..."
    docker-compose exec app npx prisma migrate deploy
}

# Function to seed database
seed() {
    echo "🌱 Seeding database..."
    docker-compose exec app npm run db:seed
}

# Main script logic
case "$1" in
    "dev")
        dev
        ;;
    "prod")
        prod
        ;;
    "stop")
        stop
        ;;
    "clean")
        clean
        ;;
    "migrate")
        migrate
        ;;
    "seed")
        seed
        ;;
    *)
        echo "Usage: $0 {dev|prod|stop|clean|migrate|seed}"
        echo ""
        echo "Commands:"
        echo "  dev     - Start development environment with hot reload"
        echo "  prod    - Start production environment"
        echo "  stop    - Stop all running services"
        echo "  clean   - Clean up all Docker resources"
        echo "  migrate - Run database migrations"
        echo "  seed    - Seed the database"
        exit 1
        ;;
esac 