# Port Configuration for Production

## Overview
This document explains the port configuration for the production deployment to avoid confusion.

## Port Mapping Summary

| Component | External Port | Internal Port | Purpose |
|-----------|---------------|---------------|---------|
| **Web Application** | 80 | 3005 | Main app access |
| **Database** | 5432 | 5432 | PostgreSQL access |

## Detailed Configuration

### Application Ports
- **External Port 80**: Standard HTTP port for web access
  - Users access the app via: `http://localhost` or `https://yourdomain.com`
  - No port number needed in URLs (port 80 is default for HTTP)
  
- **Internal Port 3005**: Container port where Next.js runs
  - Avoids conflicts with existing apps on port 3000
  - Health checks use this internal port
  - Application configuration uses this port

### Why This Configuration?

1. **Avoid Port Conflicts**: Your server already has an app on port 3000
2. **Standard Web Access**: Port 80 is the standard HTTP port
3. **Clean URLs**: No port numbers needed for external access
4. **Internal Consistency**: All internal references use port 3005

## Docker Configuration

### Dockerfile
```dockerfile
ENV PORT=3005
EXPOSE 3005
HEALTHCHECK CMD wget http://localhost:3005/api/health
```

### Docker Compose
```yaml
ports:
  - "80:3005"  # external:internal
environment:
  - PORT=3005
  - NEXTAUTH_URL=http://localhost  # No port needed for :80
```

## Access Examples

### Development
```bash
# Start development server (usually port 3000)
npm run dev

# Access: http://localhost:3000
```

### Production
```bash
# Start production containers
docker compose -f docker-compose.prod.yml up -d

# External access: http://localhost (port 80)
# Internal health check: http://localhost:3005/api/health
```

## Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | 3005 | Internal container port |
| `NEXTAUTH_URL` | `http://localhost` | External URL (no port for :80) |
| `NEXTAUTH_URL` (custom) | `https://yourdomain.com` | Production domain |

## Troubleshooting

### Port Already in Use
If you get "port already in use" errors:

- **Port 80**: Another web server is running
  - Change external port: `"8080:3005"` 
  - Update NEXTAUTH_URL: `http://localhost:8080`

- **Port 3005**: Another app is using this internal port
  - Change internal port in Dockerfile and docker-compose.yml
  - Update health checks and environment variables

### Health Check Issues
- Health checks always use the internal port (3005)
- External port (80) is only for user access
- If health checks fail, verify port 3005 is available in container 