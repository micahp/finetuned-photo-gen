# Docker Setup for Finetuned Photo Gen

This project includes Docker configuration for both development and production environments.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.x

## Quick Start

### Development Environment
```bash
# Start development environment with hot reload
npm run docker:dev
```

### Production Environment
```bash
# Start production environment
npm run docker:prod
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run docker:dev` | Start development environment with hot reload |
| `npm run docker:prod` | Start production environment |
| `npm run docker:stop` | Stop all running services |
| `npm run docker:clean` | Clean up all Docker resources |
| `npm run docker:migrate` | Run database migrations |
| `npm run docker:seed` | Seed the database |

## Manual Docker Commands

### Development
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Production
```bash
docker-compose up --build -d
```

## Services

### App Container
- **Port**: 3000
- **Health Check**: `/api/health`
- **Environment**: Configurable via docker-compose files

### Database Container
- **Image**: PostgreSQL 15 Alpine
- **Port**: 5432
- **Database**: `finetuned_photo_gen`
- **User**: `postgres`
- **Password**: `password` (change in production!)

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables for Docker:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Application URL
- `NEXTAUTH_SECRET`: Authentication secret

## Health Monitoring

The application includes a health check endpoint:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-XX...",
  "service": "finetuned-photo-gen"
}
```

## Troubleshooting

### Docker Build Issues
1. Ensure Docker Desktop is running
2. Check available disk space
3. Try cleaning Docker cache: `docker system prune -f`

### Database Connection Issues
1. Wait for PostgreSQL health check to pass
2. Check database logs: `docker-compose logs db`
3. Verify DATABASE_URL environment variable

### Port Conflicts
If ports 3000 or 5432 are in use:
1. Stop conflicting services
2. Or modify ports in docker-compose files

## Production Deployment

For production deployment:

1. **Update secrets** in docker-compose.yml
2. **Configure environment variables** properly
3. **Set up SSL/TLS** termination (nginx, cloudflare, etc.)
4. **Configure backup strategy** for PostgreSQL data
5. **Set up monitoring** and logging

## Frontend/Backend Separation Ready

This Docker setup is designed to support future frontend/backend separation:

- **Standalone Next.js build** enabled
- **API routes** can run independently
- **CORS configuration** ready for cross-origin requests
- **Environment-based configuration** for different deployment scenarios

## Next Steps for Separation

When ready to separate frontend and backend:

1. Create separate Dockerfiles for frontend and backend
2. Configure CORS for API routes
3. Update environment variables for different services
4. Deploy frontend to Vercel and backend to your preferred platform 

## Zero-Downtime Updates on a Single Server

These steps let you build the new Docker image *while the old container keeps serving traffic*. Downtime is reduced to only the few seconds required to replace the container.

### Fast Rolling Update (recommended)
```bash
# 1. Pull the latest code
git pull

# 2. Build the new image **without** touching the running container
# (adds the newer image to the local cache)
docker compose build            # or: docker compose build <service>

# 3. Recreate containers in the background
#    – Compose stops the old container and immediately starts the new one
#    – If the build had failed, the old site would have kept running
docker compose up -d            # or: docker compose up -d <service>
```
Shortcut: `docker compose up -d --build` performs steps 2 + 3 in one command—Compose builds first and only swaps containers if the build succeeds.

### Near Zero-Downtime (blue-green style)
1. Run a second stack on a different project name / port:
   ```bash
   docker compose -p myapp-v2 -f docker-compose.yml up -d --build
   ```
2. Wait for health checks to pass.
3. Point your load-balancer / Nginx upstream to the new port and reload it:
   ```bash
   # example for nginx
   nginx -s reload
   ```
4. Remove the old stack when satisfied:
   ```bash
   docker compose -p myapp-v1 down
   ```

This approach keeps user-visible interruption to a single reverse-proxy reload (< 1 s).

> **Tip:** Tagging images with the current git SHA (e.g., `myapp:<SHA>`) makes rollbacks trivial:
> ```bash
> HASH=$(git rev-parse --short HEAD)
> docker compose build --tag myapp:$HASH
> docker compose up -d myapp:$HASH
> ``` 