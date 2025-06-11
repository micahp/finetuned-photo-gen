# Production-optimized multi-stage build for AI image generation app
FROM node:18.19.1-alpine3.19 AS base

# Install security updates and essential packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    libc6-compat \
    ca-certificates \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user early for better security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Dependencies stage - production only
FROM base AS deps

# Copy package files for dependency installation
COPY package.json package-lock.json* ./

# Install production dependencies with optimizations
RUN npm ci --only=production --no-audit --no-fund --legacy-peer-deps && \
    npm cache clean --force

# Build dependencies stage - includes devDependencies needed for build
FROM base AS build-deps

# Copy package files for dependency installation
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build process)
RUN npm ci --no-audit --no-fund --legacy-peer-deps && \
    npm cache clean --force

# Development stage (unchanged for compatibility)
FROM base AS dev
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "dev"]

# Builder stage - optimized for build performance
FROM build-deps AS builder

# Build environment variables - needed for static analysis during build
ARG STRIPE_API_TOKEN
ARG STRIPE_PUBLISHABLE_TOKEN
ARG NEXT_PUBLIC_STRIPE_CREATOR_PLAN_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_PRO_PLAN_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_ULTRA_PLAN_PRICE_ID
ARG NEXTAUTH_SECRET
ARG DATABASE_URL
ARG NEXT_PUBLIC_GA_TRACKING_ID

# Set environment variables for build
ENV STRIPE_API_TOKEN=${STRIPE_API_TOKEN}
ENV STRIPE_PUBLISHABLE_TOKEN=${STRIPE_PUBLISHABLE_TOKEN}
ENV NEXT_PUBLIC_STRIPE_CREATOR_PLAN_PRICE_ID=${NEXT_PUBLIC_STRIPE_CREATOR_PLAN_PRICE_ID}
ENV NEXT_PUBLIC_STRIPE_PRO_PLAN_PRICE_ID=${NEXT_PUBLIC_STRIPE_PRO_PLAN_PRICE_ID}
ENV NEXT_PUBLIC_STRIPE_ULTRA_PLAN_PRICE_ID=${NEXT_PUBLIC_STRIPE_ULTRA_PLAN_PRICE_ID}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_PUBLIC_GA_TRACKING_ID=${NEXT_PUBLIC_GA_TRACKING_ID}

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build optimizations
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Verify the build completed successfully and standalone assets exist
RUN ls -la .next && test -f .next/BUILD_ID
RUN ls -la .next/standalone && test -f .next/standalone/server.js
RUN ls -la .next/static

# Production runner stage - security and performance optimized
FROM base AS runner

# Production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3005
ENV HOSTNAME="0.0.0.0"

# Security: ensure we're running as non-root
USER nextjs

# Create necessary directories with proper permissions
USER root
RUN mkdir -p /app/.next && \
    chown nextjs:nodejs /app/.next && \
    mkdir -p /app/tmp && \
    chown nextjs:nodejs /app/tmp
USER nextjs

# Copy production dependencies from the production deps stage  
COPY --from=deps /app/node_modules ./node_modules

# Copy Next.js binary specifically for runtime
COPY --from=builder /app/node_modules/.bin/next ./node_modules/.bin/next
COPY --from=builder /app/node_modules/next ./node_modules/next

# Copy package.json for npm scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy built application with proper ownership
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy standalone server files (the main server)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets to the correct location for standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Also copy next.config.js if it affects runtime
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js

# Copy Prisma files for database operations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

# Expose port
EXPOSE 3005

# Enhanced health check with better error handling
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider --timeout=3 http://localhost:3005/api/health || exit 1

# Use dumb-init for proper signal handling and graceful shutdown
ENTRYPOINT ["dumb-init", "--"]

# Start the application with standalone server
CMD ["node", "server.js"] 