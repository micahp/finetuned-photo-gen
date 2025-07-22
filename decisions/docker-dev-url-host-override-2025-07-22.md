### [Decision 1]: Override dev Docker compose DATABASE_URL to host machine
**Timestamp (UTC):** 2025-07-22T18:45:00Z
**Scope:** Dockerfile, docker-compose.dev.yml
**Change Summary:** In dev containers we now hard-code `DATABASE_URL` to use `host.docker.internal` so Prisma connects to the developer’s local Postgres; added global npm retry/back-off settings and a curl handshake diagnostic in Dockerfile.
**Rationale:** Containers previously pointed at `localhost`, breaking DB connections because that resolves to the container itself. This override keeps existing data intact without running a duplicate Postgres container, and retry logic lowers build failures on poor networks.
**Alternatives Considered:**
  - Keep forwarding the raw `.env` value — **rejected**: still resolves to container loopback.
  - Spin up a Postgres service inside compose — **rejected**: duplicates data, wastes resources.
**Trade-offs / Risks:**
  - Relies on `host.docker.internal` support (works natively on Docker Desktop; Linux users need the bridge alias already present).
  - Hard-coded user name `micah`; other devs must adjust if different.
**Follow-ups / TODOs:**
  - Document the override in `DOCKER_README.md`.
  - Consider parametrising user / db via env vars.
**Source Prompt(s):** "sicne that's just a dev thing let's have it override in the docker dev compose file isntead", "it worked! git commit that", "and commit decisions file" 