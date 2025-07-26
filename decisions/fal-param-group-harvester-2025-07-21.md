### [Decision 1]: Add Fal parameter grouping harvester script
**Timestamp (UTC):** 2025-07-21T15:30:00Z
**Scope:** scripts/grab_fal_params.py, scripts/fal_input_groups.json
**Change Summary:** Added a utility Python script that parses our TS `VIDEO_MODELS` list, scrapes each Fal model’s API page, splits the input fields into “above-the-fold” vs. “advanced,” and writes the result to JSON. Committed the initial run output.
**Rationale:** Automates upkeep of UI parameter groupings rather than maintaining a fragile static table; ensures new models inherit correct UX decisions automatically.
**Alternatives Considered:**
  - Manual table updates — error-prone, quickly outdated.
  - Hard-coding groups in TS — duplicates Fal’s UI logic, diverges over time.
**Trade-offs / Risks:**
  - Relies on Fal front-end markup; scraper may break if DOM structure shifts.
  - Adds external HTTP calls; consider caching or CI scheduling limits.
**Follow-ups / TODOs:**
  - Improve scraper regex to use `id="schema-input"` anchor (current run couldn’t locate the block).
  - Integrate into CI weekly job.
  - Surface JSON in the docs or dev tooling for form generation.
**Source Prompt(s):** commit that script and help me analyze that output 