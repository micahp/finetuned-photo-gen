### [Decision 2]: 1-second polling & live Fal log surfacing
**Timestamp (UTC):** 2025-07-25T18:00:00Z
**Scope:**
- `src/lib/fal-video-service.ts`
- `src/app/api/video/status/[jobId]/route.ts`
- `src/hooks/use-job-progress.ts`
- `src/app/dashboard/video/page.tsx`

**Change Summary:**
1. Decreased polling interval from 5 s → 1 s for snappier progress updates.
2. Extended `VideoGenerationResponse` with `logs: string[]` and `progress` fields.
3. Backend now returns the last 10 Fal queue log lines on every status request.
4. React hook emits only new lines via `onLog`; UI video page pipes them into the on-screen “Logs” panel.
5. Progress display is capped at 99 % until status transitions to `completed` to avoid false 100 % peaks.

**Rationale:**
- **User feedback:** During 2-5 min renders, users perceived 5 s gaps as frozen UI. 1 s feels real-time without overwhelming the server.
- **Debuggability:** Raw Fal logs reveal frame-write speed, stuck steps, or safety-checker failures — invaluable for support.
- **Cost:** 1 s polling → 60 req/min/job. At <500 B per response this is ~30 KB/min, negligible versus video upload bandwidth.

**Alternatives Considered:**
- **Maintain 5 s interval** — less traffic but poorer UX.
- **WebSockets or return to SSE** — still carry the earlier buffering/infra drawbacks.

**Trade-offs / Risks:**
- Slightly higher load on our `/status` route and Prisma look-ups. Benchmarked at <2 ms/req, safe.
- Fal API quota: every second we call `fai.queue.status` only while status = processing, typical jobs last ≤180 s → ≤180 calls.

**Follow-ups / TODOs:**
- Introduce adaptive back-off (e.g. 1 s up to 90 %, then 3 s) to cut tail traffic.
- Trim stored `logs` to 50 lines client-side to bound memory.
- Delete legacy SSE proxy & subscriber once unused.

**Source Prompt(s):**
> “fal logs should display in the logs section in ui as well…”
> “change it to poll every second.” 