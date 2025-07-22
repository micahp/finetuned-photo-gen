# Context Summary – 2025-07-22

- Implemented retry logic for Together AI generate-prompt endpoint to mitigate transient 503 errors (see `decisions/together-ai-retry-handling-2025-07-22.md`).
- Enhanced image prompt generator creativity: new PromptSmith instructions, higher temperature, removed stop tokens (see `decisions/image-prompt-creativity-update-2025-07-22.md`).
- Updated dev docker-compose to forward DATABASE_URL from .env (see `decisions/docker-db-url-env-2025-07-22.md`). 
- Overrode `DATABASE_URL` inside dev compose to `host.docker.internal` and added npm retry logic for registry resilience (see `decisions/docker-dev-url-host-override-2025-07-22.md`). 