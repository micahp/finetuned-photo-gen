### [Decision 2]: Tier-grouped, mode-filtered model dropdown
**Timestamp (UTC):** 2025-07-21T00:00:00Z
**Scope:** src/app/dashboard/video/page.tsx
**Change Summary:** Replaced flat model selector with a dropdown grouped by cost tier (Premium, Standard, Budget) and filtered by generation mode so users only see appropriate models. Crown icon marks Premium tier.
**Rationale:** Reduces option fatigue and prevents invalid model/mode combinations, aligning UI with new pricing tiers.
**Alternatives Considered:**
- Separate pages for text vs image models — extra navigation friction.
- Keep flat list — dropdown becomes unwieldy (>20 models).
**Trade-offs / Risks:**
- Tier derived from costPerSecond until `tier` field exists; changes in pricing thresholds may mis-classify.
- Additional grouping markup adds DOM complexity.
**Follow-ups / TODOs:**
- Swap to explicit `model.tier` once backend provides it.
- Display cost range when resolution multipliers affect price.
**Source Prompt(s):** “continue with tasks” → dropdown refactor implementation.

### [Decision 1]: Backend parameter support for video generation
**Timestamp (UTC):** 2025-07-21T00:00:00Z
**Scope:** src/lib/fal-video-service.ts, src/app/api/video/generate/route.ts
**Change Summary:** Added support for negativePrompt, enhancePrompt, effects, extend, firstFrame, lastFrame, resolution across service, typings, validation, and API route. Included `isResolutionSupported` helper.
**Rationale:** Fal.ai API now exposes richer parameters; supporting them unlocks advanced generation features and resolution-based pricing.
**Alternatives Considered:**
- Handle new params via generic key/value bag — increases runtime errors.
- Postpone support — blocks Phase 3 timeline.
**Trade-offs / Risks:**
- Regex-based model capability checks may break if slugs change.
- Validation surface increases; requires updated tests.
**Follow-ups / TODOs:**
- Update front-end forms to expose new params.
- Add unit tests for param inclusion and resolution validation.
**Source Prompt(s):** “start on phase 3” → backend param integration. 