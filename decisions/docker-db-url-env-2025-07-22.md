### [Decision 1]: Let DATABASE_URL flow from .env into dev container
**Timestamp (UTC):** 2025-07-22T12:40:00Z
**Scope:** docker-compose.dev.yml
**Change Summary:** Replaced hard-coded `DATABASE_URL` with `${DATABASE_URL}` in the app service’s environment block so whatever value is in the host `.env` file is passed through unchanged.
**Rationale:** The explicit URL was overriding the intended value; Prisma inside the container couldn’t connect when developers used a custom DB string. Using variable substitution respects per-developer configs.
**Alternatives Considered:**
  - Remove the `DATABASE_URL` line entirely and rely on `env_file` precedence. Chose explicit interpolation for clarity.
**Trade-offs / Risks:**
  - Requires developers to define `DATABASE_URL` in their `.env`; otherwise container will start with an empty variable.
**Follow-ups / TODOs:**
  - Document this in README dev setup section.
**Source Prompt(s):** we just need the database url from the .env to propogate through to the container 