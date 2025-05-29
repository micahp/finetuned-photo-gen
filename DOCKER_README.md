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