### [Decision 1]: Phase-2 Fal catalogue update
**Timestamp (UTC):** 2025-07-20T13:05:00Z
**Scope:** src/lib/video-models.ts, src/lib/fal-video-service.ts, docs/context-summary-2025-07-19.md
**Change Summary:** Added nine missing Fal.ai endpoints, refreshed enums for Veo-2 & Stable-Video-Diffusion, and introduced new 4:5 aspect-ratio support.
**Rationale:** Align internal model catalogue with latest Fal specs, ensuring validation passes and users see newest models without backend errors.
**Alternatives Considered:**
  - Defer catalogue sync until Phase-3 UI work — backend would fail validation.
  - Runtime spec fetch — added latency & caching complexity.
**Trade-offs / Risks:**
  - Provisional pricing may need later adjustment.
  - Slight bundle size increase.
**Follow-ups / TODOs:**
  - Update UI dropdowns for new aspect-ratios/durations.
  - Implement profanity filter (Outstanding Work #2).
**Source Prompt(s):** Phase 1 is done. Implement phase 2. 