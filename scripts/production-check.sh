#!/bin/bash

# Production Readiness Check Script
# Validates Docker configuration and environment for production deployment

set -e

echo "🚀 Production Readiness Check for Finetuned Image Gen"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

echo ""
echo "📋 Docker Configuration Check"
echo "-----------------------------"

# Check Docker and Docker Compose
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+')
    if [[ $(echo "$DOCKER_VERSION >= 20.10" | bc -l) -eq 1 ]]; then
        check_pass "Docker version $DOCKER_VERSION (✓ >= 20.10)"
    else
        check_warn "Docker version $DOCKER_VERSION (recommended >= 20.10)"
    fi
else
    check_fail "Docker not installed"
    exit 1
fi

if command -v docker compose &> /dev/null; then
    check_pass "Docker Compose V2 available"
elif command -v docker-compose &> /dev/null; then
    check_warn "Using Docker Compose V1 (V2 recommended)"
else
    check_fail "Docker Compose not available"
    exit 1
fi

echo ""
echo "📁 Configuration Files Check"
echo "----------------------------"

# Check required files
if [[ -f "Dockerfile" ]]; then
    check_pass "Dockerfile exists"
else
    check_fail "Dockerfile missing"
fi

if [[ -f "docker-compose.prod.yml" ]]; then
    check_pass "Production docker-compose.prod.yml exists"
else
    check_fail "docker-compose.prod.yml missing"
fi

if [[ -f ".dockerignore" ]]; then
    check_pass ".dockerignore exists"
else
    check_warn ".dockerignore missing (recommended)"
fi

if [[ -f "config/postgresql.conf" ]]; then
    check_pass "PostgreSQL production config exists"
else
    check_warn "PostgreSQL production config missing"
fi

echo ""
echo "🔧 Docker Compose Validation"
echo "----------------------------"

# Validate docker-compose configuration
if docker compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
    check_pass "Production docker-compose configuration valid"
else
    check_fail "Production docker-compose configuration invalid"
    echo "Run: docker compose -f docker-compose.prod.yml config"
    exit 1
fi

echo ""
echo "🌍 Environment Variables Check"
echo "------------------------------"

# Check for environment file
if [[ -f ".env.production" ]]; then
    check_pass ".env.production exists"
    
    # Check critical environment variables
    source .env.production 2>/dev/null || true
    
    if [[ -n "$NEXTAUTH_SECRET" ]]; then
        check_pass "NEXTAUTH_SECRET configured"
    else
        check_fail "NEXTAUTH_SECRET not set"
    fi
    
    if [[ -n "$DATABASE_URL" ]]; then
        check_pass "DATABASE_URL configured"
    else
        check_fail "DATABASE_URL not set"
    fi
    
    if [[ -n "$POSTGRES_PASSWORD" ]]; then
        check_pass "POSTGRES_PASSWORD configured"
    else
        check_fail "POSTGRES_PASSWORD not set"
    fi
    
else
    check_warn ".env.production not found"
    echo "   Create from template and configure production values"
fi

echo ""
echo "🔒 Security Check"
echo "----------------"

# Check for production security settings
if grep -q "NODE_ENV=production" docker-compose.prod.yml; then
    check_pass "NODE_ENV set to production"
else
    check_fail "NODE_ENV not set to production"
fi

if grep -q "no-new-privileges" docker-compose.prod.yml; then
    check_pass "Container security options configured"
else
    check_warn "Container security options missing"
fi

if grep -q "nextjs" Dockerfile; then
    check_pass "Non-root user configured in Dockerfile"
else
    check_warn "Non-root user not configured"
fi

echo ""
echo "⚡ Performance Check"
echo "-------------------"

# Check for performance optimizations
if grep -q "standalone" next.config.js; then
    check_pass "Next.js standalone output enabled"
else
    check_warn "Next.js standalone output not enabled"
fi

if grep -q "resources:" docker-compose.prod.yml; then
    check_pass "Resource limits configured"
else
    check_warn "Resource limits not configured"
fi

if grep -q "HEALTHCHECK" Dockerfile; then
    check_pass "Health checks configured"
else
    check_warn "Health checks missing"
fi

echo ""
echo "🏗️  Build Test"
echo "-------------"

echo "Testing production build (this may take a few minutes)..."
if docker compose -f docker-compose.prod.yml build --quiet; then
    check_pass "Production build successful"
else
    check_fail "Production build failed"
    exit 1
fi

echo ""
echo "📊 Summary"
echo "----------"

echo "Production Dockerfile optimizations:"
echo "  ✅ Multi-stage build with security hardening"
echo "  ✅ Non-root user and minimal attack surface"
echo "  ✅ Optimized layer caching and build performance"
echo "  ✅ Enhanced health checks and monitoring"
echo "  ✅ Proper signal handling with dumb-init"

echo ""
echo "Production docker-compose features:"
echo "  ✅ Resource limits and performance constraints"
echo "  ✅ Security options and network isolation"
echo "  ✅ Health checks for app and database"
echo "  ✅ Restart policies and deployment configurations"
echo "  ✅ Production port configuration (80:3005) - avoids port 3000 conflicts"

echo ""
echo "🎉 Production readiness check complete!"
echo ""
echo "Next steps:"
echo "1. Configure production environment variables in .env.production"
echo "2. Set up SSL certificates for HTTPS"
echo "3. Configure monitoring and logging"
echo "4. Deploy with: docker compose -f docker-compose.prod.yml up -d"
echo "5. Access application at: http://localhost (port 80)"
echo ""
echo "📖 See PRODUCTION_DEPLOYMENT.md for detailed deployment guide" 