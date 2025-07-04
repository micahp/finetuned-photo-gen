#!/bin/bash

# Video Thumbnail Generator Script
# Usage: ./scripts/generate-thumbnail.sh <video-filename> [time-offset]
# Example: ./scripts/generate-thumbnail.sh director.mp4 5
# Example: ./scripts/generate-thumbnail.sh minimax.mp4 (uses default 3 second offset)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if FFmpeg is installed
check_ffmpeg() {
    if ! command -v ffmpeg &> /dev/null; then
        print_error "FFmpeg is not installed. Please install it first:"
        echo "  macOS: brew install ffmpeg"
        echo "  Ubuntu: sudo apt install ffmpeg"
        echo "  Windows: Download from https://ffmpeg.org/download.html"
        exit 1
    fi
}

# Function to get video duration
get_video_duration() {
    local video_path="$1"
    ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$video_path" 2>/dev/null || echo "0"
}

# Function to generate thumbnail
generate_thumbnail() {
    local video_file="$1"
    local time_offset="${2:-3}"  # Default to 3 seconds
    
    # Paths
    local video_path="public/videos/$video_file"
    local video_name="${video_file%.*}"  # Remove extension
    local thumbnail_name="${video_name}-thumb.jpg"
    local thumbnail_path="public/thumbnails/$thumbnail_name"
    
    # Check if video file exists
    if [[ ! -f "$video_path" ]]; then
        print_error "Video file not found: $video_path"
        exit 1
    fi
    
    # Create thumbnails directory if it doesn't exist
    mkdir -p public/thumbnails
    
    # Get video duration
    local duration=$(get_video_duration "$video_path")
    local duration_int=${duration%.*}  # Remove decimal part
    
    # Validate time offset
    if [[ $duration_int -gt 0 && $time_offset -ge $duration_int ]]; then
        print_warning "Time offset ($time_offset s) is longer than video duration ($duration_int s)"
        time_offset=$((duration_int / 2))  # Use middle of video
        print_info "Using middle of video: ${time_offset}s"
    fi
    
    print_info "Generating thumbnail for: $video_file"
    print_info "Input: $video_path"
    print_info "Output: $thumbnail_path"
    print_info "Time offset: ${time_offset}s"
    
    # Generate thumbnail using FFmpeg
    if ffmpeg -i "$video_path" \
        -ss "$time_offset" \
        -vframes 1 \
        -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" \
        -q:v 2 \
        -y \
        "$thumbnail_path" 2>/dev/null; then
        
        print_info "✅ Thumbnail generated successfully: $thumbnail_path"
        
        # Show file info
        local file_size=$(du -h "$thumbnail_path" | cut -f1)
        print_info "File size: $file_size"
        
        # Optionally open the thumbnail (macOS only)
        if [[ "$OSTYPE" == "darwin"* ]] && command -v open &> /dev/null; then
            read -p "Open thumbnail? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                open "$thumbnail_path"
            fi
        fi
        
    else
        print_error "Failed to generate thumbnail"
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Video Thumbnail Generator"
    echo ""
    echo "Usage: $0 <video-filename> [time-offset-seconds]"
    echo ""
    echo "Arguments:"
    echo "  video-filename    Name of the video file in public/videos/"
    echo "  time-offset       Time in seconds to extract frame from (default: 3)"
    echo ""
    echo "Examples:"
    echo "  $0 director.mp4"
    echo "  $0 director.mp4 5"
    echo "  $0 minimax.mp4 10"
    echo ""
    echo "Available videos:"
    if [[ -d "public/videos" ]]; then
        ls -1 public/videos/*.mp4 2>/dev/null | sed 's|public/videos/||' | sed 's/^/  /' || echo "  No MP4 files found"
    else
        echo "  public/videos directory not found"
    fi
}

# Main script
main() {
    # Check if we're in the right directory
    if [[ ! -d "public/videos" ]]; then
        print_error "This script must be run from the project root directory"
        print_error "Current directory: $(pwd)"
        exit 1
    fi
    
    # Check arguments
    if [[ $# -eq 0 ]]; then
        show_usage
        exit 1
    fi
    
    if [[ "$1" == "-h" || "$1" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # Check FFmpeg
    check_ffmpeg
    
    # Generate thumbnail
    generate_thumbnail "$1" "$2"
}

# Run main function with all arguments
main "$@" 