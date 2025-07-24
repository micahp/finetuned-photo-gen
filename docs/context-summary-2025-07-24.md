# Context Summary – 2025-07-24

- **SSE stability hardening** – Added `closeController()` guard to prevent double-close errors and removed forbidden headers in Edge runtime.
- **Progress fallback for silent models** – `/api/fal/stream` now emits `progress` events based on `metrics.percent_complete` when log lines lack percentages (e.g. Stable-Video-Diffusion).
- **URL encoding fix** – Dropped `encodeURIComponent(modelId)` in the SSE proxy path so identifiers with `/` resolve correctly.
- **Global gzip off** – `compress:false` in `next.config.js` stops Node from buffering SSE responses; no Edge dependency.
- **Client error propagation** – `fal-log-subscriber.ts` forwards EventSource errors to callers’ `onError`.
- **Route simplification** – `/api/fal/stream` trimmed to ~80 LOC: single retry loop, close guard, metrics progress.
- **Heartbeat & raw debug** – Route emits `{type:'heartbeat'}` during silent stretches and subscriber logs raw frames.
- **Parameter naming fallback** – Route accepts both camelCase and snake_case query params.
- **Un-deduped Fal logs** – Forwards every log line (no skipping duplicates).
- **Polling loop logs** – Fallback queue polling forwards logs & derived progress.
- **Live CLI validator** – `scripts/test-fal-stream.ts` streams events from a real Fal job for local debugging.
- **Dual URL fallback** – SSE route now alternates between encoded and raw `modelId` path forms when opening the Fal stream, eliminating 404/405 collisions across different queue back-ends.
- **Unified progress tracking** – Introduced `useJobProgress` React hook that prefers SSE (`/api/fal/stream` or Replicate) and falls back to JSON polling, replacing custom logic in video page.
- **ModelId decode fix** – `/api/fal/stream` now `decodeURIComponent`-s the `modelId` query param; subscriber stops double-encoding, preventing 422 loops.
- **Non-streaming Fal models** – Discovered that text-to-video endpoints like `fal-ai/ltxv-13b-*` close `/status/stream` immediately. SSE hook now skips streaming for models without `supportsStreamingLogs`, preventing endless reconnect loops and relying on JSON polling to fetch final video.

## Open Tasks (derived from Decision follow-ups)

### High Priority
- [ ] Emit heartbeat packets when neither logs nor metrics provide progress.
- [ ] Surface Fal log stream in UI debug panel.

### Low Priority
- [ ] Consolidate duplicated SSE dedupe logic into shared helper.
- [ ] Parameterize gzip flag via env for prod flexibility. 