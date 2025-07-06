backup:
  image: alpine:3.20          # client-only, no server
  entrypoint: ["/bin/sh","/scripts/loop.sh"]
  volumes:
    - ./backups:/backups
    - ./scripts/backup:/scripts:ro   # ← mounts the loop
  environment:
    - POSTGRES_DB=${POSTGRES_DB:-finetuned_photo_gen}
    - POSTGRES_USER=${POSTGRES_USER:-postgres}
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    - PGPASSWORD=${POSTGRES_PASSWORD}
    - BACKUP_RETENTION_DAYS=30
  depends_on:
    db:
      condition: service_healthy
  networks:
    - app-network
  restart: unless-stopped