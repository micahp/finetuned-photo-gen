# Decision – De-duplicate Boot & Storage Logs with `logOnce` (2025-07-23)

## Status
Accepted – implemented on 2025-07-23.

## Context
Repeated imports and service instantiations caused the following diagnostic lines to flood logs on every API request and background job:

* `[Boot] DATABASE_URL is set ✅` (from `src/lib/db.ts`)
* `✅ Fal.ai API token found` (from `src/lib/fal-video-service.ts` constructor)
* `☁️  Using Cloudflare R2 for ZIP file storage` / `⚠️  Using LOCAL storage for ZIP files` (from `CloudStorageService.validateConfig()`)

These messages are useful sanity-checks **once per process start**, but become noise when emitted hundreds of times in production or during test runs.

## Decision
1. Introduced `src/lib/log-once.ts` utility:
   ```ts
   export function logOnce(key: string, fn: () => void) {
     const cache = (globalThis as any).__logOnceCache || new Set<string>()
     ;(globalThis as any).__logOnceCache = cache
     if (cache.has(key)) return
     cache.add(key)
     fn()
   }
   ```
2. Wrapped the noisy boot messages with `logOnce()`:
   * `boot.database_url` in `src/lib/db.ts`
   * `boot.fal_token` in `src/lib/fal-video-service.ts`
   * `boot.storage_r2` and `boot.storage_local` in `src/lib/cloud-storage.ts`
3. Moved the DB boot log **after** Prisma singleton initialisation so the message prints only on the first real connection.

## Consequences
* Production & CI logs are now significantly cleaner – each boot banner appears exactly once per process.
* Retains valuable visibility into configuration (DB URL, Fal token, storage backend) without spamming.
* Minimal run-time overhead (~Set lookup) and zero external dependencies.

## Follow-ups / Next Steps
* Consider turning `FalVideoService` and `CloudStorageService` into exported singletons to remove constructor overhead entirely.
* Add a sampling helper (e.g. `logSampled`) for high-volume progress or polling logs.

## References
* Commit implementing the change: <pending SHA> 