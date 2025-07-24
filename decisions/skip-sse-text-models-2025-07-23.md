# Decision – Skip SSE Subscription for Text-to-Video Models (2025-07-23)

## Status
Deprecated – superseded on 2025-07-23 by updated Fal documentation confirming text-to-video models support `subscribe()` SSE logs.

## Context
Initial testing suggested Fal.ai’s **text-to-video** endpoints lacked real-time `subscribe()` support, but the official docs have since clarified that *all queue-based endpoints* (including text-to-video) stream logs via `status/stream` and the `fal.subscribe()` helper.

## Decision (reversed)
* Remove the guard that blocked SSE for text-to-video models.
* Any model with a valid `falModelId` now opens the SSE proxy; if an endpoint truly lacks streaming logs it will simply return empty `logs` arrays—no harm done.

## Consequences (after reversal)
* Real-time progress bars now work for LTX Video 13B and other text-to-video models.
* No observable 422 errors: Fal returns streaming data rather than rejecting the request.
* Slightly higher network traffic per job (~1 SSE stream), but negligible impact.

## Follow-ups
1. Update any monitoring filters that expected 422 “fail” rows for text models—these should disappear.
2. Keep an eye on endpoints that still emit no percentage logs; consider emitting periodic heartbeat events so the UI remains responsive. 