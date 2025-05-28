#!/bin/bash

# Database Backup Script for Docker Compose PostgreSQL
# Creates timestamped SQL dumps and manages backup retention

set -e  # Exit on any error

# Configuration
BACKUP_DIR="./backups/database"
CONTAINER_NAME="finetuned-image-gen-db-1"  # Default docker-compose container name
DB_NAME="finetuned_photo_gen"
DB_USER="postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_${TIMESTAMP}.sql"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}🔄 Starting database backup...${NC}"

# Check if container is running
if ! docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: Database container '$CONTAINER_NAME' is not running${NC}"
    echo "Please start your Docker Compose services with: docker-compose up -d"
    exit 1
fi

# Create backup
echo -e "${YELLOW}📦 Creating backup: $BACKUP_FILE${NC}"
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --verbose --clean --if-exists > "$BACKUP_DIR/$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Backup created successfully: $BACKUP_DIR/$BACKUP_FILE${NC}"
    
    # Get file size
    BACKUP_SIZE=$(ls -lh "$BACKUP_DIR/$BACKUP_FILE" | awk '{print $5}')
    echo -e "${GREEN}📊 Backup size: $BACKUP_SIZE${NC}"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Cleanup old backups
echo -e "${YELLOW}🧹 Cleaning up backups older than $RETENTION_DAYS days...${NC}"
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +$RETENTION_DAYS -delete

# List all backups
echo -e "${YELLOW}📋 Available backups:${NC}"
ls -lah "$BACKUP_DIR"/backup_*.sql 2>/dev/null | tail -10 || echo "No backups found"

echo -e "${GREEN}✨ Backup process completed!${NC}" 