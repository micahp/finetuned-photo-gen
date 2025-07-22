### [Decision 1]: Watermark Visibility Fix – Full-Opacity Overlay
**Timestamp (UTC):** 2025-07-22T00:00:00Z
**Scope:** src/lib/watermark.ts
**Change Summary:** Switched Sharp composite from `blend:"overlay"` to `blend:"over"` and set explicit `opacity: 1` for watermark overlays. Added diagnostic alpha-channel logging for future tuning.
**Rationale:** Logs showed watermark PNG alpha ≈ 31 % and overlay mode suppressed luminance on bright backgrounds, making the watermark nearly invisible. Using full-opacity `over` blend guarantees brand protection and deters misuse.
**Alternatives Considered:**
  - Keep `overlay` but increase watermark PNG alpha — rejected; relies on asset editing and still background-dependent.
  - Keep `overlay` and add Sharp `opacity` — rejected; overlay opacity still light on bright pixels.
**Trade-offs / Risks:**
  - 100 % opacity may slightly obscure corner pixels.
  - Hard-coded opacity/size could frustrate users; future configurability recommended.
**Follow-ups / TODOs:**
  - Remove verbose debug logs once visibility confirmed in production.
  - Expose watermark size/opacity via env vars for fine-tuning.
**Source Prompt(s):** "watermark should have 100% opacity" 