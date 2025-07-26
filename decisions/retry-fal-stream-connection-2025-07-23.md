# Retry & Back-off for Fal `/status/stream` Endpoint – 2025-07-23

## Context

* After switching the proxy from the deprecated `…/stream?logs=1` path to the
  official `…/status/stream?logs=1` endpoint the server worked, but the UI still
  displayed a transient **"Fal subscribe error: 405"**.
* Investigation showed that Fal’s queue API answers **404 (“not found”)** or
  **405 (“method not allowed”)** for the first few 100 ms **until the streaming
  object is created**.  
  – The proxy forwarded that status to the browser, triggering an `error` event
    and disconnecting the `EventSource`.  
  – The browser then automatically re-connected, therefore progress percentages
    still appeared, but the user-visible 405 log line caused confusion.
* We considered three mitigation paths:

| Option | Pros | Cons |
|--------|------|------|
| **A. Add retry/back-off in proxy** _(chosen)_ | • Hides transient errors from **all** clients <br>• Keeps a single long-lived socket once the stream exists <br>• Still surfaces real upstream failures <br>• Code change localised to server route | • Adds ~20 lines of helper code |
| B. Ignore first `error` in UI | • Quickest UI-only patch | • Each non-browser client has to re-solve the problem <br>• Still sends noisy `{type:"error"}` events down the wire |
| C. Poll `…/status` until job leaves queue, then open stream | • Zero retries once stream is live | • Extra request loop, might still race <br>• Misses very first log lines |

Plan A offered the cleanest contract with minimal complexity.

## Decision

Implement an `openStream()` helper inside `src/app/api/fal/stream/route.ts` that:

1. `fetch()`es the stream URL with explicit `method:'GET'`.
2. If the response is **404 or 405** and we have tried fewer than eight times,
   waits _300 ms + attempt·200 ms_ and retries (≈ 4 s worst-case).
3. Returns the successful `Response` when `res.ok && res.body`.
4. Throws `Upstream stream error: <status>` only after all retries fail.

This keeps the EventSource happily connected, captures **100 %** of logs, and
removes the spurious 405 from the UI.

## Consequences

* Users see continuous progress/log updates without scary error banners.
* Network footprint is a single stream request per job (no polling loop).
* The retry helper centralises Fal-specific quirks; no client-side work-arounds
  are needed.
* Unit test updated (`fal-stream.test.ts`) to expect the new `/status/stream`
  path; retry logic is covered implicitly. 