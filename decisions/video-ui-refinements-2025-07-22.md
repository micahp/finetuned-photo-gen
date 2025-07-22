### [Decision 1]: Phase-3b Video UI Refinements
**Timestamp (UTC):** 2025-07-22T00:00:00Z
**Scope:** src/app/dashboard/video/page.tsx, src/components/video/AdvancedParametersForm.tsx
**Change Summary:** Implemented cleaner Advanced Settings toggle, added icon badges with explanatory labels after selection, converted Resolution field to ShadCN Select, and default-select baseline resolution. Fixed SSR `File` reference and Select empty-value errors.
**Rationale:** Enhances usability (clarifies advanced options, prevents confusion over default resolution), ensures visual consistency, and avoids server-side crashes.
**Alternatives Considered:**
  - Keep native `<select>` for resolution — rejected for inconsistent styling.
  - Leave resolution blank and rely on placeholder — rejected; ambiguous default.
**Trade-offs / Risks:**
  - Added auto-selection logic may mask unknown resolutions if API adds new baseline.
**Follow-ups / TODOs:**
  - Verify badges for other upcoming capabilities (lip-sync audio models).
**Source Prompt(s):** “use baseline resolution to auto select resolution so that value shows by default” 