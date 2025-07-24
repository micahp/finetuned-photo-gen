### [Decision 1]: Guard SSE controller close & add metrics-based progress fallback
**Timestamp (UTC):** 2025-07-24T00:00:00Z
**Scope:** src/app/api/fal/stream/route.ts, next.config.js, src/lib/fal-log-subscriber.ts
**Change Summary:** Added `closeController()` helper to avoid double-close errors, extracted `metrics.percent_complete` to emit progress events, removed forbidden headers, and ensured gzip disabled globally.
**Rationale:** Prevents `Invalid state: Controller is already closed` exceptions flooding logs and keeps progress bar active for models that don't emit percentage logs.
**Alternatives Considered:**
  - Keep try/catch around `controller.close()` — rejected as noisy and brittle.
  - Client-side synthetic progress — rejected in favour of real backend metric.
**Trade-offs / Risks:**
  - Slightly more server CPU per progress packet (extra if-check).
  - Adds edge runtime but still compatible with Vercel limits.
**Follow-ups / TODOs:**
  - Emit heartbeat packets when neither logs nor metrics provide progress.
  - Surface raw log stream in UI debug panel.
**Source Prompt(s):** create decisions file, create context summary for today base don 07/23 summary, commit decision file to context summary, create a git commit for staged changes only and those decision and context files 