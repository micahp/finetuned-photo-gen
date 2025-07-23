# Decision – Skip SSE Subscription for Text-to-Video Models (2025-07-23)

## Status
Accepted – implemented on 2025-07-23.

## Context
Fal.ai’s **text-to-video** endpoints (e.g. `fal-ai/ltxv-13b-098-distilled`) do not currently support the `subscribe` WebSocket API that streams real-time queue logs. Our dashboard nevertheless opened an SSE proxy (`/api/fal/stream`) for every generation, causing a second request that Fal answered with **HTTP 422**. These failures polluted the Fal dashboard and confused monitoring, even though the original `queue.submit` request succeeded.

## Decision
* Add a guard in `src/app/dashboard/video/page.tsx` that opens the SSE connection **only for models whose `mode === 'image-to-video'`** (all known image-to-video endpoints emit streaming logs).
* When the selected model is text-to-video, the UI now logs “Skipping SSE subscription – model does not expose streaming logs” and relies exclusively on backend polling for progress/completion.

## Consequences
* No more spurious 422 “fail” rows in the Fal dashboard.
* Real-time progress remains available for image-to-video models.
* One less outbound request per text-to-video job (~5 % latency win for first frame).

## Follow-ups
1. When Fal exposes streaming logs for text-to-video, extend `VIDEO_MODELS` with `supportsStreamingLogs: true` and update the guard.
2. Consider surfacing a spinner state that makes clear *why* live progress is absent for certain models. 