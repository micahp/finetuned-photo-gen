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