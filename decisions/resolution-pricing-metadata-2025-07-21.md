### [Decision 1]: Add resolution-aware pricing metadata
**Timestamp (UTC):** 2025-07-21T00:00:00Z
**Scope:** src/lib/video-models.ts
**Change Summary:** Introduced optional `baselineResolution` & `resolutionMultipliers` fields to `VideoModel` interface and populated them for WAN 2.1 and PixVerse v4.5 variants. This embeds resolution-specific cost data without altering existing `costPerSecond` baselines.
**Rationale:** Some Fal.ai endpoints price clips by resolution. Storing multipliers alongside the baseline lets runtime logic adjust credit cost accurately while keeping the single-source pricing table intact.
**Alternatives Considered:**
  - Dynamic calculation in service layer — rejected for auditability.
  - Ignoring resolution variance — rejected (inaccurate charges).
**Trade-offs / Risks:**
  - Slightly larger static model objects.
  - Need to update CI scripts to validate multiplier presence.
**Follow-ups / TODOs:**
  - Implement runtime resolution selection & cost calculation.
  - Extend `verify_video_models.py` to validate multiplier presence.
  - Add unit tests for new pricing path.
**Source Prompt(s):** identify which models have multiple resolutions … need a plan to price that resolution … a resolution multiplier for those models is what we need. 