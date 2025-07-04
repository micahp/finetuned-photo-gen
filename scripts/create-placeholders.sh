#!/bin/bash

# Ensure the directories exist
mkdir -p public/thumbnails
mkdir -p public/posters
mkdir -p public/videos

# Create a 1x1 transparent PNG for placeholder images
function create_placeholder_png() {
  local output_file=$1
  # Minimal PNG for a 1x1 transparent image
  printf '\x89PNG\x0d\x0a\x1a\x0a\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0cIDATx\xda\xed\xc1\x01\x01\x00\x00\x00\xc2\xa0\xf7Om\x00\x00\x00\x00IEND\xaeB`\x82' > "$output_file"
  echo "Created placeholder: $output_file"
}

# Create a minimal valid MP4 for placeholder videos (using ffmpeg if available, otherwise a dummy file)
function create_placeholder_mp4() {
  local output_file=$1
  if command -v ffmpeg &> /dev/null
  then
    # Create a 1-second black video at 10x10 resolution
    ffmpeg -f lavfi -i color=c=black:s=10x10:d=1 -pix_fmt yuv420p -c:v libx264 -profile:v baseline -level 3.0 -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -movflags frag_keyframe+empty_moov -f mp4 "$output_file" -y
    echo "Created placeholder: $output_file"
  else
    # Fallback to a dummy file if ffmpeg is not installed
    dd if=/dev/zero of="$output_file" bs=1M count=1
    echo "Created dummy placeholder (ffmpeg not found): $output_file"
  fi
}

# Image files
create_placeholder_png public/thumbnails/framepack-thumb.jpg
create_placeholder_png public/thumbnails/kangaroo-thumb.jpg
create_placeholder_png public/thumbnails/wan-i2v-example-thumb.jpg
create_placeholder_png public/thumbnails/archer-in-the-woods-thumb.jpg

create_placeholder_png public/posters/framepack-poster.png
create_placeholder_png public/posters/kangaroo-poster.png
create_placeholder_png public/posters/wan-i2v-example-poster.png
create_placeholder_png public/posters/archer-in-the-woods-poster.png

# Video files
create_placeholder_mp4 public/videos/framepack.mp4
create_placeholder_mp4 public/videos/kangaroo.mp4
create_placeholder_mp4 public/videos/wan-i2v-example.mp4
create_placeholder_mp4 public/videos/archer-in-the-woods.mp4 