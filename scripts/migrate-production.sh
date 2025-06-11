#!/bin/bash

# Production Database Migration Script
# Safely applies pending migrations to production database

set -e  # Exit on any error

echo "🔍 Production Database Migration Script"
echo "========================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set your production DATABASE_URL before running migrations"
    exit 1
fi

# Function to check migration status
check_migration_status() {
    echo "📊 Checking current migration status..."
    npx prisma migrate status --schema=./prisma/schema.prisma
}

# Function to apply pending migrations
apply_migrations() {
    echo "🚀 Applying pending migrations..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma
    
    if [ $? -eq 0 ]; then
        echo "✅ Migrations applied successfully!"
    else
        echo "❌ Migration failed!"
        exit 1
    fi
}

# Function to generate Prisma client
generate_client() {
    echo "🔧 Generating Prisma client..."
    npx prisma generate --schema=./prisma/schema.prisma
    
    if [ $? -eq 0 ]; then
        echo "✅ Prisma client generated successfully!"
    else
        echo "❌ Prisma client generation failed!"
        exit 1
    fi
}

# Main execution
case "${1:-status}" in
    "status")
        check_migration_status
        ;;
    "apply" | "deploy")
        check_migration_status
        echo ""
        read -p "🤔 Do you want to apply pending migrations? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            apply_migrations
            generate_client
        else
            echo "❌ Migration cancelled by user"
            exit 0
        fi
        ;;
    "force")
        echo "⚠️  Force applying migrations without confirmation..."
        apply_migrations
        generate_client
        ;;
    *)
        echo "Usage: $0 {status|apply|force}"
        echo ""
        echo "Commands:"
        echo "  status  - Check current migration status (default)"
        echo "  apply   - Apply pending migrations with confirmation"
        echo "  force   - Apply pending migrations without confirmation"
        echo ""
        echo "Example:"
        echo "  DATABASE_URL='your-prod-db-url' $0 status"
        echo "  DATABASE_URL='your-prod-db-url' $0 apply"
        exit 1
        ;;
esac

echo "🎉 Migration script completed!" 