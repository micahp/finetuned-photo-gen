### [Decision 1]: Phase 3b – Add Advanced Video Parameters UI
**Timestamp (UTC):** 2025-07-21T23:15:00Z
**Scope:** src/components/video/AdvancedParametersForm.tsx, src/app/dashboard/video/page.tsx
**Change Summary:** Created a dedicated `AdvancedParametersForm` component and embedded it under a collapsible “Advanced” section in the dashboard’s Video generator page. Extended the RHF schema, default values, and form-submission logic so the new parameters (`negativePrompt`, `enhancePrompt`, `effects`, `extend`, `firstFrame`, `lastFrame`, `resolution`) are validated client-side and sent to `/api/video/generate`.
**Rationale:** Implements remaining Phase 3b requirements, giving power-users access to the richer parameter set uncovered by the Fal spec scrape while keeping the primary UI streamlined behind an accordion.
**Alternatives Considered:**
  - Inline all fields in the main form — rejected for cluttering UX.
  - Separate page/modal for advanced options — added navigation friction.
**Trade-offs / Risks:**
  - Heuristic field-support detection may drift; needs replacement with `fal_input_groups.json`.
  - More complex client schema; future params require dual updates (component + Zod).
**Follow-ups / TODOs:**
  - Integrate harvester JSON for precise per-model capability mapping.
  - Implement dynamic cost-range display (`phase3-cost-range-display`).
  - Update / add Jest & RTL tests for new UI paths.
**Source Prompt(s):** Handoff – Phase 3b Front-End UI Refactor; “commit decisions file” 