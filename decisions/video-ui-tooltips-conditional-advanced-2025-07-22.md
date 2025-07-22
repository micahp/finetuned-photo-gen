### [Decision 1]: Video-UI Tooltips & Conditional Advanced Section
**Timestamp (UTC):** 2025-07-22T00:00:00Z
**Scope:** src/app/dashboard/video/page.tsx, src/components/video/AdvancedParametersForm.tsx
**Change Summary:** Added descriptive tooltips to capability icons in the model selector and hid the Advanced Settings section (including divider) when the selected model exposes no optional parameters.
**Rationale:** Clarifies the meaning of iconography, reduces cognitive load, and prevents empty UI blocks, creating a cleaner experience.
**Alternatives Considered:**
  - Leave icons without labels — rejected; ambiguous for new users.
  - Always show Advanced Settings with disabled fields — rejected; unnecessary clutter.
**Trade-offs / Risks:**
  - Slight increase in DOM nodes due to tooltip wrappers.
  - Advanced section detection relies on `fal_input_groups.json`; mismatches could hide available options.
**Follow-ups / TODOs:**
  - Validate icon–capability mapping for upcoming models (lip-sync audio variants).
**Source Prompt(s):** “how will users know what these icons mean?”; “only show the advanced settings section … when there are actually additional settings to choose” 