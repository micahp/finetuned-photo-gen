### [Decision 1]: Env-Driven Pricing Overrides for Video Cost Calculation
**Timestamp (UTC):** 2025-07-21T23:59:00Z
**Scope:** `src/lib/fal-video-service.ts`, `src/__tests__/lib/video-pricing.test.ts`
**Change Summary:** Added support for environment-variable–controlled pricing: per-model fixed `costPerSecond` and a global multiplier. Unit tests updated to new baseline values.
**Rationale:** Enables rapid pricing experiments and staging/production tiering without code changes; aligns tests with updated Pixverse + WAN rates.
**Alternatives Considered:**
  - Hard-code new rates — inflexible across environments.
  - Feature flag library — overkill for simple numeric overrides.
**Trade-offs / Risks:**
  - Misconfigured env vars could silently skew billing.
  - Multiplier and per-model overrides interaction order must remain documented.
**Follow-ups / TODOs:**
  - Add validation & logging for extreme overrides.
  - Surface pricing preview in admin UI.
**Source Prompt(s):** “Fix failing expectations in ‘Video pricing overrides’ tests… update baseline to 20, multiplier 40, override 7.”

---

### [Decision 2]: Advanced Parameters Field Visibility via `fal_input_groups.json`
**Timestamp (UTC):** 2025-07-21T23:59:00Z
**Scope:** `src/components/video/AdvancedParametersForm.tsx`, `src/data/fal_input_groups.json`
**Change Summary:** UI now derives which advanced controls to show by consulting harvester-generated mapping; regex heuristics retained as fallback.
**Rationale:** Keeps front-end in lock-step with backend spec scraper, reducing manual updates and incorrect field exposure.
**Alternatives Considered:**
  - Continue regex heuristics — brittle as specs evolve.
  - Runtime API fetch per model — too slow and rate-limited.
**Trade-offs / Risks:**
  - Mapping must be regenerated when Fal adds parameters.
  - Temporary dual-system (mapping + heuristics) adds code path complexity.
**Follow-ups / TODOs:**
  - Automate harvester run in CI to refresh JSON.
  - Remove heuristics once mapping covers 100 % of models.
**Source Prompt(s):** “Wire field-support map—drive field visibility from `fal_input_groups.json`.” 