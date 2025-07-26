### [Decision 1]: Adjust Pixverse & WAN Video Model Pricing
**Timestamp (UTC):** 2025-07-21T00:00:00Z
**Scope:** src/lib/video-models.ts
**Change Summary:** Updated baseline `costPerSecond` and `resolutionMultipliers` for Pixverse v4.5 variants and WAN models to align with target credit pricing tiers.
**Rationale:** Existing credit pricing (14 and 12.5) under-charged relative to compute costs, causing negative margins. Raising baselines to 20 (Pixverse) and 25 (WAN) restores profitability.
**Alternatives Considered:**
  - Keep previous pricing — rejected due to loss-making rates.
  - Apply uniform markup across all resolutions — rejected; finer control per resolution gives clearer value ladder.
**Trade-offs / Risks:**
  - Higher prices may reduce conversion for budget users.
**Follow-ups / TODOs:**
  - Update front-end cost display unit tests to reflect new pricing (planned).
**Source Prompt(s):**
  - "for pixverse base should be bumped up to 20 ..."
  - "for wan we actually want our multiplers to result in ..." 