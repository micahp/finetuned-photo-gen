#!/usr/bin/env python3

"""
Script to delete all HuggingFace models for cleanup

Usage: 
  python scripts/delete-all-huggingface-models.py --all                    # Delete all models
  python scripts/delete-all-huggingface-models.py --pattern unknown-model  # Delete models matching pattern
  python scripts/delete-all-huggingface-models.py --list                   # List all models
  python scripts/delete-all-huggingface-models.py --dry-run                # Show what would be deleted

This script helps clean up test/development models from HuggingFace.
"""

import sys
import os
import argparse
from huggingface_hub import HfApi, list_models, delete_repo
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
load_dotenv('.env')

def get_all_user_models(username, api_token):
    """Get all models for the specified user"""
    try:
        api = HfApi(token=api_token)
        models = list(api.list_models(author=username))
        return [(model.id, model.id.split('/')[-1]) for model in models]
    except Exception as error:
        print(f"❌ Error fetching models: {error}")
        return []

def delete_huggingface_repo(repo_name, username, api_token, dry_run=False):
    """Delete a HuggingFace repository"""
    try:
        full_repo_name = f"{username}/{repo_name}" if '/' not in repo_name else repo_name
        
        if dry_run:
            print(f"🔍 Would delete: {full_repo_name}")
            return True
            
        delete_repo(
            repo_id=full_repo_name,
            token=api_token,
            repo_type="model"
        )
        
        print(f"✅ Successfully deleted: {full_repo_name}")
        return True
        
    except Exception as error:
        print(f"❌ Failed to delete {full_repo_name}: {error}")
        return False

def confirm_deletion(models, pattern=None):
    """Ask user to confirm deletion"""
    print(f"\n⚠️  WARNING: You are about to delete {len(models)} model(s)")
    
    if pattern:
        print(f"📝 Pattern filter: '{pattern}'")
    else:
        print("🔥 This will delete ALL your models!")
    
    print("\nModels to be deleted:")
    for full_name, short_name in models:
        print(f"  - {full_name}")
    
    print(f"\n💥 This action cannot be undone!")
    response = input(f"\nType 'DELETE {len(models)} MODELS' to confirm: ")
    
    return response == f"DELETE {len(models)} MODELS"

def main():
    parser = argparse.ArgumentParser(description='Delete HuggingFace models')
    parser.add_argument('--all', action='store_true', help='Delete all models')
    parser.add_argument('--pattern', type=str, help='Delete models matching pattern')
    parser.add_argument('--list', action='store_true', help='List all models')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted without actually deleting')
    
    args = parser.parse_args()
    
    # Check if no arguments provided
    if not any([args.all, args.pattern, args.list, args.dry_run]):
        parser.print_help()
        print("\n❌ Please specify an action: --all, --pattern, --list, or --dry-run")
        sys.exit(1)
    
    # Get environment variables
    api_token = os.getenv('HUGGINGFACE_API_TOKEN')
    username = os.getenv('HUGGINGFACE_USERNAME')
    
    if not api_token:
        print("❌ HUGGINGFACE_API_TOKEN environment variable is required")
        sys.exit(1)
    
    if not username:
        print("❌ HUGGINGFACE_USERNAME environment variable is required")
        sys.exit(1)
    
    print(f"🔍 Fetching models for user: {username}")
    all_models = get_all_user_models(username, api_token)
    
    if not all_models:
        print("📭 No models found or error fetching models")
        sys.exit(0)
    
    # Filter models based on arguments
    if args.list:
        print(f"\n📋 Found {len(all_models)} model(s):")
        for full_name, short_name in all_models:
            print(f"  - {full_name}")
        sys.exit(0)
    
    models_to_delete = all_models
    
    if args.pattern:
        models_to_delete = [
            (full_name, short_name) for full_name, short_name in all_models
            if args.pattern.lower() in short_name.lower()
        ]
        print(f"🔍 Found {len(models_to_delete)} model(s) matching pattern '{args.pattern}'")
    
    if not models_to_delete:
        print("📭 No models found matching criteria")
        sys.exit(0)
    
    # Dry run mode
    if args.dry_run:
        print(f"\n🔍 DRY RUN - Would delete {len(models_to_delete)} model(s):")
        for full_name, short_name in models_to_delete:
            print(f"  - {full_name}")
        sys.exit(0)
    
    # Confirm deletion for real deletions
    if not confirm_deletion(models_to_delete, args.pattern):
        print("❌ Deletion cancelled by user")
        sys.exit(0)
    
    # Delete models
    print(f"\n🗑️  Starting deletion of {len(models_to_delete)} model(s)...")
    
    success_count = 0
    fail_count = 0
    
    for full_name, short_name in models_to_delete:
        if delete_huggingface_repo(short_name, username, api_token):
            success_count += 1
        else:
            fail_count += 1
    
    print(f"\n📊 Deletion Summary:")
    print(f"✅ Successfully deleted: {success_count}")
    print(f"❌ Failed to delete: {fail_count}")
    print(f"📝 Total processed: {len(models_to_delete)}")
    
    if success_count > 0:
        print(f"\n🎉 Cleanup completed! Deleted {success_count} model(s)")
    
    if fail_count > 0:
        print(f"\n⚠️  {fail_count} model(s) failed to delete - check the errors above")

if __name__ == "__main__":
    main() 