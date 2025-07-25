# Context Summary – 2025-07-25

## What changed today

- **SSE removed → Polling** – Following yesterday’s SSE instability, we fully removed the `/api/fal/stream` EventSource pipeline.  `useJobProgress` now polls `/api/video/status/[jobId]` (Decision 1).
- **1-s Poll cadence** – Reduced interval from 5 s to 1 s for snappier feedback without hurting Fal rate-limits (Decision 2).
- **Raw Fal logs surfaced** – Backend now returns the last 10 queue log lines; React hook de-dupes and streams them into the dashboard “Logs” panel.
- **Progress heuristics** – `fal-video-service` derives `progress` from `metrics.percent_complete` or parsed log percentages; UI caps at 99 % until status === `completed` to avoid premature 100 %.
- **Decision logs** – Added:
  - `remove-sse-adopt-polling-2025-07-25.md`
  - `add-fal-logs-and-1s-polling-2025-07-25.md`

## Narrative (24 → 25 July)
Yesterday we hardened the SSE proxy but user testing still showed buffering and race issues.  Today we pivoted: ripped out SSE entirely, replaced it with lightweight JSON polling, and surfaced Fal log lines directly in the UI.  The new flow is simpler, works across Node runtimes, and provides real-time insight during generation.

## Open Tasks
- [X] Evaluate post-generation UX: where can users view/manage generated videos (gallery, share links, delete)?
- [ ] Upgrade existing Image Gallery to support videos (list, filter, play inline).
- [ ] Extend Recent Activity feed to include video generation events. 
- [ ] Remove dead SSE files (`/api/fal/stream`, `fal-log-subscriber.ts`) once CI passes.
- [ ] Adaptive back-off after 90 % to save API calls.
- [ ] Consolidate duplicated progress parsing into shared util. 