# Finetuned-Image-Gen – Context Summary (2025-07-20)
This document updates the July-19 context with the new model-catalogue expansion work, pricing tweaks, and implementation phases agreed today.

---

## 2. Architectural Goal  
We continue the sprint to expose the **full Fal.ai video-generation portfolio (now 30 endpoints)** while preserving credit-based billing and safety guarantees.  New items since 2025-07-19:

1. **Wan 2.1 FLF2V** (first-frame ➜ last-frame) added — enables two-frame interpolation.
2. **Veo-2 *image-to-video*** endpoint surfaced alongside existing text-to-video variant.
3. Model pricing table refreshed to reflect Fal’s July-20 list prices; provisional internal **`costPerSecond = Fal price × 2`** rule still applies until Finance signs-off.

---

## 3. High-Level Comparison vs Specs  
• Specs folder now stores **30** OpenAPI files (Wan FLF2V added today).  
• `VIDEO_MODELS` currently maps **24** logical models → **19** Fal endpoints.  
• **8 endpoints missing** & **6 endpoints with stale enums** (see list below).  
• Service layer lacks support for **`negative_prompt`, `enhance_prompt`, `effects`, `extend`**.

### 3.1 Missing Endpoints (to be added in Phase 2)
`fast-svd`, `fast-svd-lcm`, `ltx-video/13b-dev` *(image & extend)*, `ltx-video/v095` *(image & multiconditioning)*, `pixverse/v4.5/text-to-video` *(effect variant)*, `wan/t2v 2.1`, **wan-flf2v** *(new today)*.

### 3.2 Endpoints Requiring Enum Refresh
• **veo2** – AR = `["16:9","9:16"]` only.  
• **veo3 / veo3-fast** – duration = `["5s","6s","7s","8s"]`.  
• **seedance v1 lite/pro** – AR adds `"1:1"`, drops `"3:4"`.  
• **minimax hailuo-02 pro/std** – duration = `["6s","10s"]`.  
• **stable-video-diffusion** – AR gains `"4:5"`.

---

## 4. Phased Implementation Plan (July-20)  
### Phase 1 – Model Catalogue Automation  
1. Parse every OpenAPI file under `scripts/fal_api_specs/` into a typed `FalEndpointSpec`.  
2. Generate JSON + Markdown diffs (`fal_spec_snapshot.json`, `fal_video_model_diff.md`).  
3. CI fails if snapshot ≠ code.

### Phase 2 – `VIDEO_MODELS` Table  
1. Add **8+1 new endpoints** (list §3.1) with accurate enums & provisional pricing.  
2. Update enums for six existing models.  
3. Introduce `"4:5"` to `getDimensions()` helper.

### Phase 3 – `FalVideoService` Extensions  
1. Extend `VideoGenerationParams` with:
   ```ts
   negativePrompt?: string
   enhancePrompt?: boolean
   effects?: string[]
   extend?: boolean
   firstFrame?: string  // wan-flf2v
   lastFrame?: string   // wan-flf2v
   ```
2. Map new fields conditionally per endpoint (e.g. `effects` → Pixverse, `extend` → LTX dev_extend, `firstFrame/lastFrame` → Wan FLF2V).
3. Strengthen validation helpers (`isDurationSupported`, `isAspectRatioSupported`).

### Phase 4 – Tests  
• Expand test matrix to cover all new enums & request fields.
• Add regression test ensuring rejection of unsupported AR/duration.

### Phase 5 – Documentation & Pricing Review  
• Update docs/pricing tables, highlighting “cost TBD” rows.  
• Draft migration guide for front-end dropdown changes.

---

## 5. Outstanding Work & Next Tasks  
1. **Finish Phase 1 parser & diff tooling** (P0).  
2. **Insert new endpoint entries in `VIDEO_MODELS`** (P0).  
3. **Refactor `FalVideoService`** to accept new params & Wan FLF2V first/last-frame logic (P1).  
4. **Front-End**: update aspect-ratio & duration dropdowns (P1).  
5. **Profanity filter** research & integration (carry-over) (P1).  
6. **Billing audit** – verify cost propagation to Stripe (P0).  
7. **R2 lifecycle policy** for video expiry (P2).  
8. **DB migration** to back-fill `effects` column default `[]` (P2).

---

## 6. Decision Log (Incremental)  
• **Decision**: Adopt *first-frame/last-frame* interpolation model (**wan-flf2v**) to capture emerging trend.  
  **Rationale**: Differentiates product; minimal engineering lift due to shared Fal interface.  
  **Alternatives**: Wait for Veo-4 – rejected (unknown timeline).

---

*End of summary.* 