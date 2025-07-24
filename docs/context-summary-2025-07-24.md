# Context Summary – 2025-07-24

- **SSE stability hardening** – Added `closeController()` guard to prevent double-close errors and removed forbidden headers in Edge runtime.
- **Progress fallback for silent models** – `/api/fal/stream` now emits `progress` events based on `metrics.percent_complete` when log lines lack percentages (e.g. Stable-Video-Diffusion).
- **URL encoding fix** – Dropped `encodeURIComponent(modelId)` in SSE proxy path, eliminating 404/405 retries.
- **Global gzip off** – `compress:false` in `next.config.js` stops Node from buffering SSE responses; no Edge dependency.
- **Client error propagation** – `fal-log-subscriber.ts` forwards `EventSource` errors to the caller’s `onError` handler.
- **Route simplification** – `/api/fal/stream` refactored to 80 LOC: unified retry loop, single close guard, deduped logs, metrics-based progress.  Easier to audit and extend.

## Open Tasks (derived from Decision follow-ups)

### High Priority
- [ ] Emit heartbeat packets when neither logs nor metrics provide progress.
- [ ] Surface Fal log stream in UI debug panel.

### Low Priority
- [ ] Consolidate duplicated SSE dedupe logic into shared helper.
- [ ] Parameterize gzip flag via env for prod flexibility. 