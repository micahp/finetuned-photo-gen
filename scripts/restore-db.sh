#!/bin/bash

# Database Restore Script for Docker Compose PostgreSQL
# Restores database from SQL backup files with safety checks

set -e  # Exit on any error

# Configuration
BACKUP_DIR="./backups/database"
CONTAINER_NAME="finetuned-image-gen-db-1"  # Default docker-compose container name
DB_NAME="finetuned_photo_gen"
DB_USER="postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo -e "${BLUE}Usage: $0 [backup_file]${NC}"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  backup_file    Path to SQL backup file (optional - will prompt if not provided)"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0 ./backups/database/backup_20240115_143022.sql"
    echo "  $0  # Will show available backups to choose from"
}

# Function to list available backups
list_backups() {
    echo -e "${YELLOW}📋 Available backups:${NC}"
    if ls "$BACKUP_DIR"/backup_*.sql 1> /dev/null 2>&1; then
        ls -lah "$BACKUP_DIR"/backup_*.sql | nl
    else
        echo -e "${RED}❌ No backup files found in $BACKUP_DIR${NC}"
        exit 1
    fi
}

# Function to select backup interactively
select_backup() {
    list_backups
    echo ""
    echo -e "${BLUE}Enter the number of the backup to restore (or 'q' to quit):${NC}"
    read -r selection
    
    if [[ "$selection" == "q" || "$selection" == "Q" ]]; then
        echo "Cancelled by user"
        exit 0
    fi
    
    # Get the selected file
    BACKUP_FILE=$(ls "$BACKUP_DIR"/backup_*.sql | sed -n "${selection}p")
    
    if [[ -z "$BACKUP_FILE" ]]; then
        echo -e "${RED}❌ Invalid selection${NC}"
        exit 1
    fi
}

# Parse command line arguments
if [[ $# -eq 0 ]]; then
    select_backup
elif [[ $# -eq 1 ]]; then
    if [[ "$1" == "-h" || "$1" == "--help" ]]; then
        show_usage
        exit 0
    fi
    BACKUP_FILE="$1"
else
    show_usage
    exit 1
fi

# Validate backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    echo -e "${RED}❌ Error: Backup file '$BACKUP_FILE' not found${NC}"
    exit 1
fi

echo -e "${YELLOW}🔄 Starting database restore...${NC}"
echo -e "${BLUE}📂 Backup file: $BACKUP_FILE${NC}"

# Check if container is running
if ! docker ps --format "table {{.Names}}" | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: Database container '$CONTAINER_NAME' is not running${NC}"
    echo "Please start your Docker Compose services with: docker-compose up -d"
    exit 1
fi

# Final confirmation
echo -e "${RED}⚠️  WARNING: This will COMPLETELY REPLACE the current database!${NC}"
echo -e "${YELLOW}Current database '$DB_NAME' will be dropped and recreated.${NC}"
echo ""
echo -e "${BLUE}Are you sure you want to continue? (type 'yes' to confirm):${NC}"
read -r confirmation

if [[ "$confirmation" != "yes" ]]; then
    echo "Restore cancelled by user"
    exit 0
fi

# Create a backup of current state before restore
echo -e "${YELLOW}🔄 Creating backup of current state before restore...${NC}"
CURRENT_BACKUP="./backups/database/pre_restore_backup_$(date +"%Y%m%d_%H%M%S").sql"
mkdir -p "$(dirname "$CURRENT_BACKUP")"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --verbose --clean --if-exists > "$CURRENT_BACKUP"
echo -e "${GREEN}💾 Current state backed up to: $CURRENT_BACKUP${NC}"

# Restore database
echo -e "${YELLOW}🔄 Restoring database from backup...${NC}"
if docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Database restored successfully!${NC}"
    echo -e "${BLUE}📊 Backup file: $BACKUP_FILE${NC}"
    echo -e "${BLUE}💾 Pre-restore backup: $CURRENT_BACKUP${NC}"
else
    echo -e "${RED}❌ Restore failed!${NC}"
    echo -e "${YELLOW}🔄 Attempting to restore from pre-restore backup...${NC}"
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$CURRENT_BACKUP" || true
    exit 1
fi

echo -e "${GREEN}✨ Restore process completed!${NC}" 