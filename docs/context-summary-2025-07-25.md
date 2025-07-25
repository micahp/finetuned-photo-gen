# Context Summary – 2025-07-25

## What changed today

- **SSE removed → Polling** – Following yesterday’s SSE instability, we fully removed the `/api/fal/stream` EventSource pipeline.  `useJobProgress` now polls `/api/video/status/[jobId]` (Decision 1).
- **1-s Poll cadence** – Reduced interval from 5 s to 1 s for snappier feedback without hurting Fal rate-limits (Decision 2).
- **Raw Fal logs surfaced** – Backend now returns the last 10 queue log lines; React hook de-dupes and streams them into the dashboard “Logs” panel.
- **Progress heuristics** – `fal-video-service` derives `progress` from `metrics.percent_complete` or parsed log percentages; UI caps at 99 % until status === `completed` to avoid premature 100 %.
- **Video in Gallery & Activity:** The image gallery now includes a video tab with filtering and inline previews. The dashboard's "Recent Activity" feed now shows both generated images and videos.
- **Gallery UI Alignment:** The gallery's image/video toggle has been updated to match the design of the video generation page, and a detail view modal has been added for videos to achieve feature parity with images.
- **Decision logs** – Added:
  - `remove-sse-adopt-polling-2025-07-25.md`
  - `add-fal-logs-and-1s-polling-2025-07-25.md`
  - `upgrade-gallery-video-support-2025-07-25.md`

## Narrative (24 → 25 July)
Yesterday we hardened the SSE proxy but user testing still showed buffering and race issues. Today we pivoted: ripped out SSE entirely, replaced it with lightweight JSON polling, and surfaced Fal log lines directly in the UI.  The new flow is simpler, works across Node runtimes, and provides real-time insight during generation. Whenever you spend all day on a problem, and 10+ chats, with 100+ prompts, its time to abandon the current approach and try something different. It's not worth losing a day, let alone a week. Especially when it's a simple as showing logs for what % done the video generation is. I ended up spending 3 days, 291 prompts, and 23 chats...just to scrap SSE and go back to polling. Part of the probem is I don't really understand websockets, SSE, and whatnot very well.

## Open Tasks
- [X] Evaluate post-generation UX: where can users view/manage generated videos (gallery, share links, delete)?
- [X] Upgrade existing Image Gallery to support videos (list, filter, play inline).
- [X] Extend Recent Activity feed to include video generation events. 
- [ ] Align Gallery UI with Video Generation page and add video detail view.
- [ ] Remove dead SSE files (`/api/fal/stream`, `fal-log-subscriber.ts`) once CI passes.
- [ ] Adaptive back-off after 90 % to save API calls.
- [ ] Consolidate duplicated progress parsing into shared util. 