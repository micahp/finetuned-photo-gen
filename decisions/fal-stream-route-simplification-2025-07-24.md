### [Decision 2]: Simplify /api/fal/stream route for maintainability
**Timestamp (UTC):** 2025-07-24T00:00:00Z
**Scope:** src/app/api/fal/stream/route.ts
**Change Summary:** Rewrote the SSE proxy from ~180 → 80 LOC.  Removed nested helpers, verbose debug logs, and consolidated retry/stream logic into a single loop.  Still attaches to existing Fal job, retries 404/405, dedupes logs, emits progress via log regex or metrics, and guarantees single close.
**Rationale:** Prior implementation grew organically; hard to audit and triggered duplicate-controller-close errors.  A leaner version is easier to reason about, test, and extend.
**Alternatives Considered:**
  - Keep patching the old code—risk of regressions in rarely used branches.
  - Switch to fal.subscribe() (would re-submit jobs) – conflicts with current API flow.
**Trade-offs / Risks:**
  - Removes some granular console diagnostics; rely on structured events instead.
  - Minor refactor risk mitigated by unit test and manual curl test.
**Follow-ups / TODOs:**
  - Unit test processChunk path with models that emit `metrics.percent_complete` only.
  - Implement heartbeat when neither logs nor metrics progress available.
**Source Prompt(s):** “rewrite the production route” – user requested minimal, clean code. 