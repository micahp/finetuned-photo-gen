### [Decision 2]: Show “(default)” text in resolution dropdown
**Timestamp (UTC):** 2025-07-22T00:10:00Z
**Scope:** src/components/video/AdvancedParametersForm.tsx
**Change Summary:** Added “(default)” suffix to the first resolution option label so users immediately recognise which resolution is pre-selected by default.
**Rationale:** Improves clarity and reduces confusion, especially when switching models with multiple resolution choices.
**Alternatives Considered:**
  - Placeholder hint in helper text — less discoverable.
  - Distinct styling for default option — heavier CSS change.
**Trade-offs / Risks:** Negligible; string concat in map iteration.
**Follow-ups / TODOs:** None.
**Source Prompt(s):** perfect. also add '(default)' text to the resolution option …

### [Decision 1]: Ensure base resolution is always set
**Timestamp (UTC):** 2025-07-22T00:00:00Z
**Scope:** src/app/dashboard/video/page.tsx, src/components/video/AdvancedParametersForm.tsx
**Change Summary:** Added effect in `page.tsx` to synchronise `resolution` form field with the currently-selected model, guaranteeing a valid default is set immediately. Previously updated `AdvancedParametersForm` now cleans up invalid selections on model change.
**Rationale:** Users still saw the placeholder “Select resolution” because the default value was not populated before the Advanced Settings dropdown rendered. By setting the first available resolution as soon as the model is chosen, we eliminate this UX gap and keep form state valid.
**Alternatives Considered:**
  - Lift resolution logic to a custom RHF resolver — rejected as over-engineering for a single field.
  - Hard-code per-model defaults — rejected due to maintenance overhead.
**Trade-offs / Risks:** Minimal – additional effect runs on model change only; negligible performance impact.
**Follow-ups / TODOs:**
  - Consider unit test for resolution default behaviour when swapping models.
**Source Prompt(s):** git commit change because card looks great. but we still don't set the base resolution. tis ays "select resolution" 