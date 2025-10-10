# Video Generation: Piping Fal Logs to UI – 3-Day Retrospective (2025-07-22 → 2025-07-24)

## 1. Timeline of Key Commits

| Date | Commit | Summary |
|------|--------|---------|
| 07-22 | 7835c24 | Fallback video pipeline w/ `fallbackUrl`, progress bar powered by Fal logs |
| 07-22 | 35bfc8e | Real-time video progress bar; added `fal-progress-parser`, SSE proxy skeleton |
| 07-23 | 66eb355 | Correct SSE to `/status/stream?logs=1` (fix 405) |
| 07-23 | 92bde2f | Context summary update; began retry/back-off logic |
| 07-23 | 875f19e | Removed synthetic progress ticks, secured proxy w/ API key |
| 07-23 | 8464c83 | Stream Fal queue logs via SSE; removed deprecated `fal.subscribe` path |
| 07-23 | 0d2e5e9 | Default to budget models & log dedup; query logging off |
| 07-24 | e602072 | **Route simplification** – `/api/fal/stream` trimmed to 80 LOC |
| 07-24 | a91b14a | Robust JSON trim; guard double-close; gzip off |
| 07-24 | 5e0b2c4 | **`useJobProgress` hook** – single source of truth for Fal & Replicate |
| 07-24 | 0626ebe | Real-world Fal stream integration test added |
| 07-24 | 984d705 | Docs note on non-streaming models & polling fallback |

## 2. Decisions Extract (last 72 h)

* **video-sse-buffering-fix-07-23** – add 2 KB preamble & `no-transform` headers to defeat browser buffering; extend regex to decimals.
* **retry-fal-stream-connection-07-23** – 8-try exponential retry on 404/405.
* **fal-stream-route-simplification-07-24** – rewrite proxy, consolidate helpers.
* **unified-job-progress-hook-07-24** – React hook prefers SSE, falls back to polling; cleans up ad-hoc logic in video page.

## 3. Current Architecture

```mermaid
sequenceDiagram
Browser →> VideoPage: POST /api/video/generate
VideoPage ←– Backend: { jobId, modelId }
VideoPage →> useJobProgress: start(track)
useJobProgress →> /api/fal/stream: EventSource
/api/fal/stream →> Fal Queue: GET …/status/stream?logs=1
Note right of Fal Queue: real-time data
Fal Queue –>> /api/fal/stream: SSE packets
/api/fal/stream –>> Browser: {log, progress, status}
```

## 4. Outstanding / Predicted Issues

| Risk | Likely Symptom | Mitigation |
|------|----------------|-----------|
| **Upstream 429 throttling** | Stream closes, falls to polling at peak load | Add 429 to transient list + back-off |
| **Edge 30 s timeout (dev)** | `ERR_HTTP_HEADERS_SENT` or silent close | Switch proxy to Node runtime locally |
| **Huge log payloads (>16 kB)** | Safari / Firefox crash EventSource | Slice or drop over-size logs |
| **No explicit COMPLETED but pct 100** | Job appears stalled at 100 % | Emit synthetic `done` on upstream close w/ pct 100 |
| **Non-percentage models** | Progress bar stuck at 0 % | Already covered by `metrics.percent_complete`, else send heartbeat + indeterminate bar |
| **Duplicate subscriptions via HMR** | Fast progress jumps & doubled logs | Debounce by `jobId` inside hook |

## 5. Rule Proposal – “SSE Proxy Health & Hygiene”

1. **DEBUG flag** – Every SSE proxy must expose `DEBUG_<SLUG>=1` guard that logs: candidate URLs, retries, packets forwarded, terminal status.
2. **Retry list** – `[404,405,429,502,503]` → exponential back-off (≤ 8 attempts).
3. **2 KB kick-start** – Always send `':' + ' '.repeat(2048) + '\n\n'` and `Cache-Control: no-cache, no-transform`.
4. **Payload guard** – Truncate any single message >16 kB to avoid browser buffer overflows.
5. **Synthetic done** – If stream ends with `maxPct===100` but no TERMINAL status, emit `{type:'done'}`.
6. **Client resilience** – Hooks must tolerate a single `error` event and auto-reconnect before falling back to polling.

Add this as a workspace rule (
`src/.cursor/rules/sse-proxy-health.mdc`) to enforce in PR checks.

## 6. Next Steps

* Move `/api/fal/stream` to Node runtime in local dev to bypass 30 s Edge limit.
* Extend `parseFalProgress` to capture decimal fractions (`12.0 / 121`).
* Integration test: simulate 429, 502 to ensure retry survives.
* Track `logBytesForwarded` metric to quantify network overhead after trimming. 

## 7. Code-Level Highlights from Diffs

| Commit | File(s) | Key Change |
|--------|---------|------------|
| **5179c92** | `fal/stream/route.ts` | Removed `encodeURIComponent()` on query string to stop *double-encoding* `%2F` slugs; UI now streams for nested model paths. |
| **a91b14a** | `fal/stream/route.ts` | Wrapped `JSON.parse` in `trim()` guard → avoids **SyntaxError** when Fal sends leading whitespace/BOM. |
| **e602072** | `fal/stream/route.ts` | Refactor: 180 → 80 LOC; folded *retry*, *progress parse*, *heartbeat* into one async loop; deleted `closeController` helper; reduced cyclomatic complexity from 12 → 5. |
| **0626ebe** | `fal/stream/route.ts`, `fal-log-subscriber.ts` | Added **heartbeat** event every silent packet; UI now logs `[HEARTBEAT]` instead of stalling. |
| **ccd8203** | `fal/stream/route.ts`, `next.config.js` | 1) Added `closed` flag to guard double `controller.close()`; 2) Set `compress:false` globally to bypass Node gzip buffering; 3) Included `metrics.percent_complete` fast-path (covers Stable-Video-Diffusion). |

These micro-fixes explain why the EventSource still errored even after the larger refactor—each removed one hidden edge-case. 

## 8. Narrative

Time Spent On This

Day 1:
8 + 6 + 12 + 11 = 37 prompts, 4 chats

Day 2:
2 + 15 + 22 + 1 + 8 + 2 + 20 + 4 + 13 + 4 + 15 = 106 prompts, 11 chats

Day 3:
25 + 29 + 36 + 1 + 20 + 5 + 26 + 6 = 148 prompts, 8 chats

Total: 291 prompts, 23 chats
That's how long I spun my wheels for over 3 days.

Whenever you spend all day on a problem, and 10+ chats, with 100+ prompts, its time to abandon the current approach and try something different. It's not worth losing a day, let alone a week. Especially when it's a simple as showing logs for what % done the video generation is. I ended up spending 3 days, 291 prompts, and 23 chats...just to scrap SSE and go back to polling. Part of the probem is I don't really understand websockets, SSE, and whatnot very well.