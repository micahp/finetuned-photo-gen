### [Decision 1]: Replace SSE with JSON polling for Fal progress
**Timestamp (UTC):** 2025-07-25T17:30:00Z
**Scope:**
- `src/hooks/use-job-progress.ts`
- `src/lib/fal-video-service.ts`
- `src/app/api/video/status/[jobId]/route.ts`
- Legacy files left untouched pending deletion: `src/app/api/fal/stream/route.ts`, `src/lib/fal-log-subscriber.ts`

**Change Summary:**
Replaced the EventSource-based Server-Sent Events (SSE) pipeline with periodic JSON polling via `/api/video/status/[jobId]`.  Progress now comes from Fal queue `metrics.percent_complete` or heuristics parsed from log lines.  The initial polling cadence is 5 s.

**Rationale:**
1. **Reliability:** Vercel/Next Serverless & Edge runtimes buffer SSE >1 kB, causing delayed events and double-encoding bugs.
2. **Simplicity:** Polling avoids long-lived connections and header restrictions (`Connection: keep-alive`, `X-Accel-Buffering: no`).
3. **Cost / Fit for Free Tiers:** Our Fal jobs last minutes, so ≤12 requests/min/job is acceptable; no dedicated WS infra needed.

**Alternatives Considered:**
- **Keep patching SSE** — already spent multiple days on header work-arounds; issues still surface on Safari and Cloudflare proxies.
- **WebSockets** — adds infra complexity (WS gateway, heart-beat, auth); overkill for low-frequency updates.

**Trade-offs / Risks:**
- +50-100 ms latency vs streaming — acceptable UX.
- Slight increase in request count; Fal queue has generous rate limits (120 RPS/project).

**Follow-ups / TODOs:**
- Fine-tune polling interval based on real-world latency vs API cost (see Decision 2).
- Delete obsolete SSE files once fully confident.

**Source Prompt(s):**
> “Now let's get rid of SSE entirely and ONLY use polling.” 