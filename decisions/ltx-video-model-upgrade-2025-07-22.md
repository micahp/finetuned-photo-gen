# LTX Video Model Upgrade – 2025-07-22

**Scope:** `src/lib/video-models.ts`, `src/data/fal_input_groups.json`, parameter-harvest scripts

## Context
The previous LTX entries referenced the 0.9.5/0.9.7 model family. Fal released v0.9.8 Distilled (13B, custom LoRA) with significant quality gains while keeping the same pricing ($0.02 / sec → 5 credits/sec in our accounting).

## Decision
1. Replaced legacy IDs with the new endpoints:
   - `ltx-video-13b-distilled` ➜ updated `falModelId` to `fal-ai/ltxv-13b-098-distilled/image-to-video`.
   - `ltx-video-v095-mc-image` ➜ renamed to `ltx-video-v098-mc-image` and pointed to `…/multiconditioning` endpoint.
   - `ltx-v095-text` ➜ renamed to `ltx-v098-text` and pointed to `fal-ai/ltxv-13b-098-distilled` (text-to-video).
2. Normalized `costPerSecond` for all three to **5 credits/sec** (matches Fal $0.02/sec rate).
3. Updated `fal_input_groups.json` keys to the new IDs (field groupings unchanged).
4. Planned re-run of `scripts/grab_fal_params.py` to regenerate the JSON map after CI passes.
5. Noted discovery: Stable Video Diffusion *image-to-video* variant **does accept a prompt**; reduced its cost to **2 credits/sec** to reflect lower Fal pricing.

## Consequences
- Front-end now surfaces the higher-quality v0.9.8 models with custom LoRA support.
- No braking API changes—IDs updated everywhere.
- Pricing UI reflects correct cost; credit deductions stay accurate.

## Follow-ups
- [ ] Trigger `grab_fal_params.py` in nightly cron to refresh param group map.
- [ ] QA pass on advanced parameter form for the three updated IDs.
- [ ] Remove superseded local specs for 0.9.5 once unused. 