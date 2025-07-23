# Decision – Stream Fal Queue Logs via `/status/stream` Endpoint (2025-07-23)

## Status
Accepted – implemented 2025-07-23. Supersedes the (now deprecated) *skip-sse* guard and aligns with Fal’s official queue-stream pattern.

## Context
We keep a **two-step** flow for video generation:
1. `fal.queue.submit()` → returns `request_id`, deducts credits, persists DB row.
2. Front-end listens for real-time logs to drive the progress bar.

`fal.subscribe()` is designed for **one-shot submit-and-stream**. Invoking it with only `{ requestId }` violates the API contract and yields **HTTP 422**.

Fal exposes a dedicated SSE feed for existing jobs:
```
GET https://queue.fal.run/{model}/requests/{request_id}/status/stream?logs=1
```
This returns the same `IN_PROGRESS` / `COMPLETED` packets (optionally with `logs`) that `subscribe()` would stream, but without resubmitting the job.

## Decision
* Replace the `fal.subscribe()` call inside `/api/fal/stream` with a proxy that fetches `/status/stream?logs=1` for the supplied `modelId` + `requestId` and converts the upstream events into the UI’s `{type:…}` messages (log, progress, status, done, error).
* Re-enable SSE for **all** video models (already done in `dashboard/video/page.tsx`).

## Consequences
* Duplicate 422 entries disappear; only the initial `POST /queue` remains.
* Live progress works for *both* text-to-video and image-to-video endpoints.
* No risk of spawning a second, paid job.

## Follow-ups
1. If Fal adds richer metadata to the stream (e.g., cost metrics) surface it in the UI.
2. Consolidate repeated SSE parsing logic into a shared utility if more routes need it. 