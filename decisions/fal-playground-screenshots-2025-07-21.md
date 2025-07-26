### [Decision 1]: Automate Playground Screenshot Capture for All Fal Models
**Timestamp (UTC):** 2025-07-21T23:59:00Z
**Scope:** `scripts/capture_fal_model.js`, `shots/` assets, bulk shell loop
**Change Summary:** Added a Playwright helper script and batch routine that navigates to each Fal.ai model Playground, captures before/after screenshots (with the settings drawer expanded), and saves them to `shots/`. The script supports both Playground and API views and robustly finds the toggle button.
**Rationale:** Visual confirmation of model parameters is faster and more reliable than scraping JSON. Screenshots give non-technical stakeholders clear evidence of available options across 45+ endpoints.
**Alternatives Considered:**
  - Stagehand automation — rejected due to missing API keys.
  - Manual captures — too slow and error-prone.
**Trade-offs / Risks:**
  - Screenshot PNGs increase repo size; may need git-ignore or artefact storage.
  - UI text labels could change, breaking the button selector.
  - Requires Playwright dependency in CI.
**Follow-ups / TODOs:**
  - Compress or exclude PNGs from version control.
  - Add error handling for 404/403 cases.
  - Integrate nightly job to detect UI changes.
**Source Prompt(s):** User asked to “visually confirm”, “be on the playground tab”, and finally “now commit decisions”. 