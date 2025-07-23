# Decision – Real-Time Video Progress Bar via Fal Logs (2025-07-22)

## Status
Accepted – implemented on 2025-07-22.

## Context
The dashboard’s video generation progress bar previously advanced using a synthetic interval (random ticks every 2 s) until the backend marked a job complete. This often mis-represented actual progress and offered no insight during stalls.

Fal’s `subscribe` websocket API streams live log messages containing percentage updates (e.g. `Decoding 43 %`). Leveraging these logs allows the UI to reflect true generation progress.

## Decision
1. Added `fal-progress-parser.ts` to convert common Fal log patterns (explicit `%`, fractional `45 / 100`) into a 0-100 percentage.
2. Added `fal-log-subscriber.ts` wrapper around `fal.subscribe` that:
   – Subscribes to a given `modelId` + `requestId`.
   – Parses logs and emits `onProgress(pct)` callbacks.
   – Emits `onDone(videoUrl)` on completion and provides a cleanup function.
3. Updated `src/app/dashboard/video/page.tsx` to:
   – Start a synthetic interval **only** until first real log arrives.
   – Update the progress bar with real percentages.
   – Clean up websocket & intervals on completion or page unload.
4. Added Jest test `fal-progress-parser.test.ts` to lock parser behaviour.

## Consequences
• Users now see accurate, responsive progress feedback, reducing support queries.
• Websocket resources are properly released, preventing memory leaks.
• The parser can be extended to support additional log formats if Fal updates output.

## References
– Fal real-time docs: <https://www.fal.ai/docs/real-time>
– JS client reference: <https://github.com/fal-ai/fal-js> 

## Follow-up Improvements (2025-07-23)
After field testing on Stable Video Diffusion text-to-video we found Fal’s queue can mark jobs **COMPLETED** a few seconds before the file is fully written to Fal’s CDN.  Fetching at that moment returns a zero-byte or partially encoded MP4 that later breaks playback.

Mitigations added 2025-07-23:
1. **Removed synchronous `fal.run` fallback**
   – If `fal.queue.submit` fails we now propagate the error instead of falling back to `fal.run` (which exposes the same premature‐file risk but without queue status).
2. **File-size stabilisation check** in `getJobStatus`:
   – Two successive `HEAD` requests (2 s apart) to the Fal video URL must return identical `content-length` before we treat the job as `completed` and start the R2 upload.
   – If the size is still growing we return `status: processing`; the dashboard keeps polling.
3. **Decision rationale**
   – Guarantees we never store/serve a truncated file.
   – Keeps a single, predictable async code-path; easier to reason about and test.

These changes were implemented in `src/lib/fal-video-service.ts` (commit 35bfc8e). 

## Follow-up Improvements (2025-07-23)
Effective now the progress bar no longer shows *any* synthetic estimates – it remains at 0 % until the first real Fal log arrives.

Changes:
1. **Removed synthetic interval entirely** in `video/page.tsx`.
2. **Introduced secure SSE proxy** (`/api/fal/stream`):
   – Server holds the Fal API key and opens the WebSocket.
   – Streams only `{type:'progress'| 'done' | 'error'}` events to the browser.
3. **Updated `fal-log-subscriber.ts`** to consume the SSE endpoint via `EventSource`.

Result: progress bar now displays only real percentages, API key never leaves the server, and the UI’s console is free of 401 errors.  

## Follow-up Bug-fixes (2025-07-24)
After launch we discovered two production issues:

1. `TypeError: Invalid state: Controller is already closed` thrown from `/api/fal/stream` once the ReadableStream had been closed.  This was harmless but polluted logs and occasionally crashed the route in dev.
2. React warning: “An empty string ("") was passed to the src attribute” because the `<video>` element was rendered while the job was still processing.

### Fix
• Introduced `safeSend()` helper inside the SSE route that catches the race between `controller.enqueue` and `controller.close()` (commit xxxxxx).  All stream writes now go through this guard.
• `VideoPlayerWithFallback` is only mounted when `generatedVideo.status === 'completed'` **and** `videoUrl` is non-empty.
• Added debug line `console.log('[SSE] log', raw, '→', pct)` to verify regex extraction across models.

### Outcome
• No more unhandled rejections in server logs.
• UI no longer renders an empty `<video>`; React warnings gone.
• Progress bar remains accurate for models that emit percentage logs.  Models that don’t (e.g. Stable-Video-Diffusion) still stall at 0 % – next todo: parse `update.metrics.percent_complete`. 

### Outstanding gaps (tracked 2025-07-24)
1. Models without percentage logs (e.g. Stable-Video-Diffusion) now keep the progress bar at 0 % for the full run.  Backend polling still finishes correctly, but the user sees a “frozen” bar.
2. The Generate button shows no spinner during that time – confusing UX.
3. Fal log lines aren’t surfaced in the on-screen Logs panel; we only log internal steps.

### Next actions
• In `/api/fal/stream` emit a generic `{type:'log', message}` event for every log line.  The client will append it to the debug panel.
• When `pct === null` emit `{type:'heartbeat'}` every N seconds so the button can keep its loading state (or fall back to an indeterminate spinner).
• Option B: derive `percent_complete` from `update.metrics` where available – but heartbeat is the quickest UX fix. 

## Bug-fix – STREAMING Phase Stalls (2025-07-23)

After launch we noticed the progress bar sometimes froze at ~10–60 % during the `Writing video` stage.
Investigation showed Fal’s queue status switches from `IN_PROGRESS` to `STREAMING` midway and those packets were being filtered out by our SSE proxy.

**Fix**
1. Updated `/api/fal/stream` to treat both `IN_PROGRESS` **and** `STREAMING` packets as progress-bearing.
2. Added `{type:'status', status}` heartbeat so the client can keep the spinner alive even when no explicit `%` logs are present.
3. Deduplicated log forwarding on the server to avoid flooding the console.

**Outcome**
* Progress bar now advances smoothly to 100 % for all models.
* Generate button spinner never stops prematurely.
* No observable increase in network chatter (logs still throttled to 1 Hz avg). 