#!/usr/bin/env bash
#
# verdaccio-build.sh — Build with Verdaccio npm cache
#
# This script:
#   1. Starts Verdaccio (local npm cache)
#   2. Waits for it to be healthy
#   3. Passes it as the npm registry to the Docker build
#   4. Optionally stops Verdaccio after (keeps running by default so cache stays warm)
#
# Usage:
#   ./scripts/verdaccio-build.sh              # build with cache, keep verdaccio running
#   ./scripts/verdaccio-build.sh --stop       # build then stop verdaccio
#   ./scripts/verdaccio-build.sh --no-cache   # force --no-cache docker build
#   ./scripts/verdaccio-build.sh --prune      # clear verdaccio storage before build
#   ./scripts/verdaccio-build.sh app migrate  # build specific services
#
set -euo pipefail

STOP_AFTER=false
NO_CACHE=""
PRUNE=false
SERVICES="app migrate"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stop)       STOP_AFTER=true; shift ;;
    --no-cache)   NO_CACHE="--no-cache"; shift ;;
    --prune)      PRUNE=true; shift ;;
    *)            SERVICES="$*"; break ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERDACCIO_URL="http://localhost:4873"

cd "$PROJECT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Verdaccio Cache Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Prune storage if requested
if $PRUNE; then
  echo "🧹 Pruning Verdaccio storage..."
  rm -rf verdaccio/storage
  echo "   Done."
fi

# Step 2: Start Verdaccio
echo "📦 Starting Verdaccio cache..."
docker compose --profile cache up -d verdaccio

# Step 3: Wait for Verdaccio to be ready
echo "⏳ Waiting for Verdaccio to be healthy..."
for i in $(seq 1 30); do
  if curl -s "$VERDACCIO_URL/-/ping" > /dev/null 2>&1; then
    echo "✅ Verdaccio is ready!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Verdaccio failed to start after 30 seconds."
    docker compose --profile cache logs verdaccio
    exit 1
  fi
  sleep 1
done

# Step 4: Build with Verdaccio as registry
echo "🔨 Building with cached registry..."
echo "   Registry: $VERDACCIO_URL"
echo "   Services: $SERVICES"

docker compose build $NO_CACHE \
  --build-arg NPM_REGISTRY="$VERDACCIO_URL" \
  $SERVICES

BUILD_EXIT=$?

# Step 5: Optionally stop Verdaccio
if $STOP_AFTER; then
  echo "🛑 Stopping Verdaccio..."
  docker compose --profile cache stop verdaccio
else
  echo "💡 Verdaccio still running (cache stays warm)"
  echo "   Stop it with: docker compose --profile cache stop verdaccio"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $BUILD_EXIT -eq 0 ]; then
  echo "✅ Build completed successfully (via Verdaccio cache)"
else
  echo "❌ Build failed (exit code: $BUILD_EXIT)"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $BUILD_EXIT
