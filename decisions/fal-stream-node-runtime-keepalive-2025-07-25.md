### [Decision]: Switch Fal SSE proxy to Node runtime & extend keep-alive
**Timestamp (UTC):** 2025-07-25T00:00:00Z
**Scope:** src/app/api/fal/stream/route.ts
**Change Summary:** Changed the SSE proxy runtime from `edge` to `nodejs` and added `Keep-Alive: timeout=120` header to keep the HTTP connection open for long-running video jobs.
Also expanded the transient 404/405 retry loop from 8 attempts (~1.6 s) to 60 attempts with a fixed 500 ms back-off (~30 s) so the proxy waits for Fal to expose the `status/stream` endpoint before giving up.
**Rationale:** Edge functions terminate after ~30 s and Node ≥19 defaults to a 5 s keep-alive timeout, both causing EventSource disconnects. Running as a Node function with an explicit 120 s keep-alive removes these platform-level cut-offs.
**Alternatives Considered:**
  - Keep Edge runtime and reconnect → extra complexity & UI flicker.
  - Use WebSocket proxy → heavier infra and Fal already provides SSE.
**Trade-offs / Risks:**
  - Slightly higher cold-start latency vs Edge.
  - Needs monitoring to ensure 120 s is sufficient for all models.
**Follow-ups / TODOs:**
  - Add contract test that asserts stream stays open >40 s.
  - Monitor `fal_sse_errors_total` metric post-deploy.
**Source Prompt(s):** "sounds good. create a decision file with those insights only, then make the changes" 