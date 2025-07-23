# Context Summary – 2025-07-23

- Introduced `logOnce` helper to ensure boot-time diagnostics are emitted only once per process (see `decisions/log-dedup-boot-messages-2025-07-23.md`).
- Wrapped noisy startup banners in `src/lib/db.ts`, `src/lib/fal-video-service.ts`, and `src/lib/cloud-storage.ts` with `logOnce`, eliminating repeated messages on every API call.
- Relocated Prisma DATABASE_URL check below singleton initialisation to prevent duplicate prints.
- Added import of `logOnce` and deduped storage-backend selection logs in `CloudStorageService.validateConfig()`.
- - Disabled Prisma SQL query logging by default; developers can re-enable by editing the constructor (see `decisions/prisma-query-logging-disable-2025-07-23.md`).
- Default model selection now picks the first **budget**-tier option for each mode, and Fal SSE logs are deduplicated to reduce noise (see `decisions/video-default-budget-models-dedup-fal-logs-2025-07-23.md`).

## Open Tasks (derived from Decision follow-ups)

### High Priority
- [ ] Convert `FalVideoService` and `CloudStorageService` into true singletons to avoid repeated constructor overhead.
- [ ] Introduce `logSampled` or similar helper for high-volume progress / polling logs.

### Low Priority
- [ ] Audit remaining `console.log` calls for potential throttling or level-downgrade to `debug`. 