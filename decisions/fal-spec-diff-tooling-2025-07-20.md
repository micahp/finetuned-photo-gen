### [Decision 1]: Add Phase-1 Spec-Diff Tooling
**Timestamp (UTC):** 2025-07-20T00:00:00Z
**Scope:** `src/lib/fal-endpoint-spec.ts`, `scripts/generate-fal-video-report.ts`, `docs/fal_video_model_diff.md`, `docs/context-summary-2025-07-19.md`
**Change Summary:** Introduced a typed `FalEndpointSpec` interface, a new CLI script that parses Fal OpenAPI specs and generates a Markdown diff report, and updated project context documentation.
**Rationale:** Automates detection of missing endpoints and enum mismatches, preventing runtime errors and accelerating future model catalogue updates.
**Alternatives Considered:**
  - Manual spreadsheet diff — error-prone and time-consuming.
  - Runtime schema fetch on every request — added latency and external dependency; rejected.
**Trade-offs / Risks:**
  - Requires periodic CI integration to stay effective.
  - Initial parsing relies on schema property names remaining stable.
**Follow-ups / TODOs:**
  - Wire script into GitHub Action to fail when discrepancies exist.
  - Extend parser to capture new extra params automatically.
**Source Prompt(s):** "Implement phase 1" → develop spec diff tooling; "commit" cue. 