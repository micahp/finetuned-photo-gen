# Advanced Video Settings UI – Gap Audit
**Date:** 2025-07-22

This note consolidates the findings from the 2025-07-22 audit of our dashboard / video advanced-settings implementation versus the latest Fal.ai specs harvested into `fal_input_groups.json`.

---

## 1 Pixverse v4.5
- **Missing control:** `effect` (singular).
- Result: Effects endpoint behaves like plain image-to-video.

## 2 Kling Models (v1.6, v2.*)
- **Missing control:** `cfg_scale` (float).
- Power users lose control over creativity / faithfulness.

## 3 WAN Family (wan-2.1, wan-flf2v, wan-2.1-t2v)
- **Missing controls:**
  - `guide_scale` (float)
  - `num_inference_steps` (int)
- **Inconsistent key:** UI switch posts `enhancePrompt`; spec uses `enable_prompt_expansion`.

## 4 LTX 13B Dev / Extend & MC Variants
- **Missing controls:** `loras`, `constant_rate_factor`, `num_frames`.

## 5 Fast-SVD / Stable-Video-Diffusion
- Advanced fields (`motion_bucket_id`, `cond_aug`, `steps`) are ignored.

## 6 Veo 3 & Veo 3 Fast
- No toggle for `generate_audio`; always sends audio.

## 7 MiniMax Hailuo Models
- Missing `prompt_optimizer` flag.

## 8 Seedance Lite / Pro
- Missing `camera_fixed` toggle.

---

### Recommended Fixes
1. **Add `effect` selector** for Pixverse Effects.
2. **Guidance / CFG scale** numeric input – unified for `cfg_scale` & `guide_scale`.
3. Map boolean flags (`prompt_optimizer`, `camera_fixed`, `enable_prompt_expansion`, `generate_audio`, etc.) into an “Expert Toggles” section.
4. Add sliders for `num_inference_steps`, `num_frames`, `constant_rate_factor` when present.
5. Update capability detection to look at both `above` *and* `advanced` arrays and maintain a `{ specKey → formField }` mapping (to handle `effect` vs `effects`).
6. Ensure `/api/video/generate` passes through new params only for models that support them.

---

*Generated automatically by dashboard audit on 2025-07-22.* 

## 9 Schema Verification (Live Check)
Verified 2025-07-22  UTC ±0

• Queried live Fal manifest for Kling 2.1 Master I2V endpoint.
• Link consulted: <https://fal.ai/models/fal-ai/kling-video/v2.1/master/image-to-video/api#input>
• All previously-listed extra parameters are present in the live `input` schema, confirming the audit items are actionable.
• OpenAPI spec in `scripts/fal_api_specs/…` is stale (missing motion-brush & lip-sync params).  The harvester should prefer live manifest when divergence detected. 