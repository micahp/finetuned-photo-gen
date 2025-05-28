#!/bin/bash

# Docker Volume Migration Script
# Backs up and restores Docker volumes for system migration

set -e  # Exit on any error

# Configuration
BACKUP_DIR="./backups/volumes"
VOLUME_PREFIX="finetuned-image-gen"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo -e "${BLUE}Docker Volume Migration Tool${NC}"
    echo ""
    echo -e "${YELLOW}Usage: $0 [backup|restore] [options]${NC}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo "  backup     Backup Docker volumes to compressed archives"
    echo "  restore    Restore Docker volumes from compressed archives"
    echo "  list       List available volume backups"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0 backup                    # Backup all project volumes"
    echo "  $0 restore                   # Restore from latest backup"
    echo "  $0 restore backup_20240115   # Restore from specific backup"
    echo "  $0 list                      # List available backups"
}

# Function to get project volumes
get_project_volumes() {
    docker volume ls --format "{{.Name}}" | grep "^${VOLUME_PREFIX}" || true
}

# Function to backup volumes
backup_volumes() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="backup_${timestamp}"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    echo -e "${YELLOW}🔄 Starting volume backup...${NC}"
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Get volumes to backup
    local volumes=$(get_project_volumes)
    
    if [[ -z "$volumes" ]]; then
        echo -e "${RED}❌ No project volumes found with prefix '$VOLUME_PREFIX'${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}📦 Found volumes to backup:${NC}"
    echo "$volumes"
    echo ""
    
    # Backup each volume
    for volume in $volumes; do
        echo -e "${YELLOW}📦 Backing up volume: $volume${NC}"
        
        # Create tar archive of volume
        docker run --rm \
            -v "$volume:/volume" \
            -v "$(pwd)/$backup_path:/backup" \
            alpine:latest \
            tar czf "/backup/${volume}.tar.gz" -C /volume .
        
        if [[ $? -eq 0 ]]; then
            local size=$(ls -lh "$backup_path/${volume}.tar.gz" | awk '{print $5}')
            echo -e "${GREEN}✅ Volume '$volume' backed up successfully ($size)${NC}"
        else
            echo -e "${RED}❌ Failed to backup volume '$volume'${NC}"
            exit 1
        fi
    done
    
    # Create metadata file
    cat > "$backup_path/metadata.json" << EOF
{
    "timestamp": "$timestamp",
    "date": "$(date -Iseconds)",
    "volumes": [
$(echo "$volumes" | sed 's/^/        "/' | sed 's/$/"/' | paste -sd ',' -)
    ],
    "docker_compose_files": [
        "docker-compose.yml",
        "docker-compose.dev.yml"
    ]
}
EOF
    
    # Copy docker-compose files for reference
    cp docker-compose*.yml "$backup_path/" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Volume backup completed: $backup_path${NC}"
    echo -e "${BLUE}📊 Backup contents:${NC}"
    ls -lah "$backup_path"
}

# Function to list backups
list_backups() {
    echo -e "${YELLOW}📋 Available volume backups:${NC}"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        echo -e "${RED}❌ No backup directory found: $BACKUP_DIR${NC}"
        exit 1
    fi
    
    local backups=$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name "backup_*" | sort -r)
    
    if [[ -z "$backups" ]]; then
        echo -e "${RED}❌ No volume backups found${NC}"
        exit 1
    fi
    
    echo "$backups" | while read -r backup; do
        local backup_name=$(basename "$backup")
        local metadata="$backup/metadata.json"
        
        if [[ -f "$metadata" ]]; then
            # Try jq first, fall back to grep/sed
            if command -v jq >/dev/null 2>&1; then
                local date=$(jq -r '.date' "$metadata" 2>/dev/null || echo "Unknown")
                local volume_count=$(jq -r '.volumes | length' "$metadata" 2>/dev/null || echo "?")
            else
                # Fallback parsing without jq
                local date=$(grep '"date":' "$metadata" | sed 's/.*"date": *"\([^"]*\)".*/\1/' | head -1)
                local volume_count=$(grep -o '"finetuned-image-gen[^"]*"' "$metadata" | wc -l | tr -d ' ')
                [[ -z "$date" ]] && date="Unknown"
                [[ -z "$volume_count" ]] && volume_count="?"
            fi
            echo -e "${GREEN}📦 $backup_name${NC} - $date ($volume_count volumes)"
        else
            echo -e "${YELLOW}📦 $backup_name${NC} - No metadata"
        fi
    done
}

# Function to restore volumes
restore_volumes() {
    local backup_name="$1"
    
    # If no backup specified, use the latest
    if [[ -z "$backup_name" ]]; then
        backup_name=$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name "backup_*" | sort -r | head -1 | xargs basename)
        
        if [[ -z "$backup_name" ]]; then
            echo -e "${RED}❌ No backups found${NC}"
            exit 1
        fi
        
        echo -e "${BLUE}🔄 Using latest backup: $backup_name${NC}"
    fi
    
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [[ ! -d "$backup_path" ]]; then
        echo -e "${RED}❌ Backup not found: $backup_path${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}🔄 Starting volume restore from: $backup_name${NC}"
    
    # Show backup info
    local metadata="$backup_path/metadata.json"
    if [[ -f "$metadata" ]]; then
        echo -e "${BLUE}📋 Backup information:${NC}"
        if command -v jq >/dev/null 2>&1; then
            jq . "$metadata"
        else
            cat "$metadata"
        fi
        echo ""
    fi
    
    # Confirmation
    echo -e "${RED}⚠️  WARNING: This will REPLACE existing volumes!${NC}"
    echo -e "${BLUE}Are you sure you want to continue? (type 'yes' to confirm):${NC}"
    read -r confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        echo "Restore cancelled by user"
        exit 0
    fi
    
    # Stop containers first
    echo -e "${YELLOW}🛑 Stopping Docker Compose services...${NC}"
    docker-compose down || true
    
    # Restore each volume
    for archive in "$backup_path"/*.tar.gz; do
        if [[ ! -f "$archive" ]]; then
            continue
        fi
        
        local volume_name=$(basename "$archive" .tar.gz)
        echo -e "${YELLOW}📦 Restoring volume: $volume_name${NC}"
        
        # Remove existing volume
        docker volume rm "$volume_name" 2>/dev/null || true
        
        # Create new volume
        docker volume create "$volume_name"
        
        # Restore data
        docker run --rm \
            -v "$volume_name:/volume" \
            -v "$(pwd)/$backup_path:/backup" \
            alpine:latest \
            sh -c "cd /volume && tar xzf /backup/$(basename "$archive")"
        
        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}✅ Volume '$volume_name' restored successfully${NC}"
        else
            echo -e "${RED}❌ Failed to restore volume '$volume_name'${NC}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}✅ Volume restore completed!${NC}"
    echo -e "${BLUE}🚀 You can now start your services with: docker-compose up -d${NC}"
}

# Main script logic
case "${1:-}" in
    "backup")
        backup_volumes
        ;;
    "restore")
        restore_volumes "$2"
        ;;
    "list")
        list_backups
        ;;
    "")
        show_usage
        exit 1
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        show_usage
        exit 1
        ;;
esac 