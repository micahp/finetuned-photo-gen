### [Decision 1]: Add retry logic for Together AI generate-prompt API
**Timestamp (UTC):** 2025-07-22T12:00:00Z
**Scope:** src/lib/fetch-with-retry.ts, src/app/api/generate-prompt/route.ts
**Change Summary:** Introduced a `fetchWithRetry` utility with exponential back-off and swapped the generate-prompt route to use it, returning proper 503 status codes on persistent upstream failures.
**Rationale:** Together AI’s free endpoint frequently returns 503 when overloaded, causing user-visible errors. Retrying transient 5xx responses improves resilience with minimal complexity.
**Alternatives Considered:**
  - Increase request timeout — does not address overloads where service immediately rejects.
  - Queue requests server-side — adds complexity and latency, unnecessary for sporadic 503s.
**Trade-offs / Risks:**
  - Adds up to ~3.5 s worst-case latency before surfacing failure.
  - Still fails if upstream outage exceeds retry window.
**Follow-ups / TODOs:**
  - Make retry count/back-off configurable via env vars.
  - Add unit tests for retry utility.
  - Monitor error rates to tune parameters.
**Source Prompt(s):** handle | Generate prompt error: Error: Together AI API error: 503 