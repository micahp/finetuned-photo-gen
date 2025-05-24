#!/usr/bin/env python3

"""
One-time script to clean up conflicting HuggingFace repositories

Usage: python scripts/cleanup-huggingface-repo.py [repo-name]

This script helps resolve the immediate repository naming conflict
by deleting the existing repository so new training can proceed.
"""

import sys
import os
from huggingface_hub import HfApi, delete_repo, list_models
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
load_dotenv('.env')

def delete_huggingface_repo(repo_name):
    api_token = os.getenv('HUGGINGFACE_API_TOKEN')
    username = os.getenv('HUGGINGFACE_USERNAME')
    
    if not api_token:
        raise ValueError('HUGGINGFACE_API_TOKEN environment variable is required')
    
    if not username:
        raise ValueError('HUGGINGFACE_USERNAME environment variable is required')

    # Add username if not in repo name
    if '/' not in repo_name:
        full_repo_name = f"{username}/{repo_name}"
    else:
        full_repo_name = repo_name
    
    print(f"🗑️ Attempting to delete HuggingFace repository: {full_repo_name}")
    
    try:
        # Use the official HuggingFace Hub library
        delete_repo(
            repo_id=full_repo_name,
            token=api_token,
            repo_type="model"
        )
        return {"success": True}
    
    except Exception as error:
        return {"success": False, "error": str(error)}

def list_huggingface_repos():
    api_token = os.getenv('HUGGINGFACE_API_TOKEN')
    username = os.getenv('HUGGINGFACE_USERNAME')
    
    if not api_token or not username:
        raise ValueError('HUGGINGFACE_API_TOKEN and HUGGINGFACE_USERNAME environment variables are required')

    try:
        # Use HfApi to list models
        api = HfApi(token=api_token)
        models = list(api.list_models(author=username))
        
        return [
            {
                "id": model.id,
                "url": f"https://huggingface.co/{model.id}",
                "tags": getattr(model, 'tags', []) or []
            }
            for model in models
        ]
    
    except Exception as error:
        raise Exception(f"Failed to list repositories: {str(error)}")

def cleanup_repo():
    if len(sys.argv) < 2:
        print("❌ Please provide a repository name to delete")
        print("Usage: python scripts/cleanup-huggingface-repo.py <repo-name>")
        print("Example: python scripts/cleanup-huggingface-repo.py geo-2025-05-24-22-10-01")
        print("Example: python scripts/cleanup-huggingface-repo.py unknown-model-2025-05-24-22-10-01")
        sys.exit(1)

    repo_name = sys.argv[1]

    try:
        result = delete_huggingface_repo(repo_name)
        
        if result["success"]:
            print(f"✅ Successfully deleted repository: {repo_name}")
            print("🎉 You can now retry your model training!")
        else:
            print(f"❌ Failed to delete repository: {result['error']}")
            print("ℹ️ Try using the web interface: https://huggingface.co/settings")
            
    except Exception as error:
        print(f"❌ Error during cleanup: {str(error)}")
        
        if 'environment variable' in str(error):
            print("\n🔧 Make sure your .env file contains:")
            print("   HUGGINGFACE_API_TOKEN=your_token_here")
            print("   HUGGINGFACE_USERNAME=your_username_here")
        
        sys.exit(1)

def list_repos():
    try:
        print("📋 Listing your HuggingFace repositories...")
        
        repos = list_huggingface_repos()
        
        if len(repos) == 0:
            print("ℹ️ No repositories found")
            return
        
        print(f"\nFound {len(repos)} repositories:")
        for index, repo in enumerate(repos, 1):
            print(f"{index}. {repo['id']}")
            print(f"   URL: {repo['url']}")
            print(f"   Tags: {', '.join(repo['tags']) if repo['tags'] else 'none'}")
            print()
        
        print("To delete a repository, run:")
        print("python scripts/cleanup-huggingface-repo.py <repo-name>")
        
    except Exception as error:
        print(f"❌ Error listing repositories: {str(error)}")
        
        if 'environment variable' in str(error):
            print("\n🔧 Make sure your .env file contains:")
            print("   HUGGINGFACE_API_TOKEN=your_token_here")
            print("   HUGGINGFACE_USERNAME=your_username_here")

if __name__ == "__main__":
    # Check if user wants to list repos first
    if len(sys.argv) > 1 and sys.argv[1] in ['--list', '-l']:
        list_repos()
    else:
        cleanup_repo() 