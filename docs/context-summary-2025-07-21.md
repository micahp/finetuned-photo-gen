# Finetuned-Image-Gen – Context Summary (2025-07-21)
This document rolls up **all work completed on July-21** and revises the roadmap based on eight new decisions:

* **Param-Group Harvester** – see `decisions/fal-param-group-harvester-2025-07-21.md`.
* **Playground Screenshot Automation** – see `decisions/fal-playground-screenshots-2025-07-21.md`.
* **Phase 3 Backend & UI Refactor** – see `decisions/phase-3a-3b-frontend-backend-2025-07-21.md`.
* **Resolution-Aware Pricing Metadata** – see `decisions/resolution-pricing-metadata-2025-07-21.md`.
* **Advanced Parameters UI** – see `decisions/phase-3b-advanced-params-ui-2025-07-21.md`.
* **Video Pricing Adjustment** – see `decisions/video-pricing-adjustment-2025-07-21.md`.
* **Env-Driven Pricing Overrides & Input Groups UI** – see `decisions/env-pricing-overrides-input-groups-ui-2025-07-21.md`.  
* **Resolution Default Fix** – see `decisions/resolution-default-fix-2025-07-22.md`.  
* **Video UI Refinements** – see `decisions/video-ui-refinements-2025-07-22.md`.  
- **Free Zero-Credit Daily Generations** – see `decisions/free-generation-zero-credit-2025-07-22.md`.
* **Watermark Visibility Fix** – see `decisions/watermark-visibility-fix-2025-07-22.md`.
* **Video-UI Tooltips & Conditional Advanced Section** – see `decisions/video-ui-tooltips-conditional-advanced-2025-07-22.md`.

---

## 1. Status Snapshot
✔️ **Phase 1 – Model Catalogue Automation** – completed yesterday, CI diff tooling live.
✔️ **Phase 2 – `VIDEO_MODELS` Table Refresh** – all eight missing endpoints added, six enums corrected.
✔️ **Phase 3a – Backend Param Support** – FalVideoService, typings, and `/api/video/generate` route now accept **negativePrompt, enhancePrompt, effects, extend, firstFrame, lastFrame, resolution** with `isResolutionSupported` helper.
➜ **Phase 3b – Front-End UI Refactor** – pending (details §3).

New assets/directories introduced today:
1. `scripts/fal_api_specs/` – canonical OpenAPI specs (now **30** files).
2. `shots/` – auto-captured before/after screenshots for every Fal model.

## 2. Data Integrity Work
The harvester script now cross-references **spec JSON → Playground UI → `VIDEO_MODELS`** to ensure:
* Correct **`falModelId`** & **mode** for all 30 endpoints.
* Up-to-date enum lists (`aspect_ratio`, `duration`).
* Parameter grouping metadata (`above`, `advanced`) exported to `fal_input_groups.json` for form generation **using local OpenAPI specs first** – the harvester no longer requires a live Fal.ai request for known endpoints.
* **Above-the-fold vs Advanced UI** – the grouping mirrors Fal’s own layout: the first ~5 “core” controls appear immediately, while less-used fields tuck under an **Advanced** accordion. The JSON drives our React form to collapse these fields by default.
* **Regex fallback removed** – `AdvancedParametersForm.tsx` now relies exclusively on the JSON mapping, guaranteeing deterministic field visibility.
* **Resolution-aware pricing metadata** – harvester captures min/max `creditsPerSecond` per resolution tier enabling front-end cost-range display.

CI fails if:
* A spec exists without a matching `VIDEO_MODELS` entry.
* Enum values diverge between spec ⇄ code.
* Harvester detects new input parameters not surfaced in TS types.

## 3. Revised Phase 3 Scope
`FalVideoService` must now support the richer feature set uncovered by specs & screenshots:

```ts
interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;      // veo, fast-svd, ltx, pixverse
  enhancePrompt?: boolean;      // veo, fast-svd, ltx
  effects?: string[];           // pixverse effect variant
  extend?: boolean;             // ltx dev_extend
  firstFrame?: string;          // wan-flf2v
  lastFrame?: string;           // wan-flf2v
  resolution?: string;          // explicit width×height for new high-res paths
  // existing fields: aspectRatio, duration, fps, …
}
```

Implementation notes:
* **Conditional payload mapping** – only send params supported by the selected model.
* **Validation helpers** – `isDurationSupported`, `isAspectRatioSupported`, and new `isResolutionSupported`.
* **Dimensions map update** – add `"4:5" → { width: 720, height: 900 }`.

**Phase 3b – Front-End UI Breakdown**

* Tier-grouped model dropdown **filtered by generation mode** – text-to-video dropdown shows only `mode: "text-to-video"` models, image-to-video dropdown shows only `mode: "image-to-video"` (`phase3-dropdown-refactor`).
* `AdvancedParametersForm` exposing **negativePrompt**, **enhancePrompt**, **effects**, **extend**, **firstFrame/lastFrame**, **resolution** (`phase3-advanced-params-form`).
* Collapsible **Advanced** accordion embedding the form (`phase3-advanced-accordion`).
* Form submission hook wiring the new fields into `FormData` for `/api/video/generate` (`phase3-form-submit-hook`).
* **Dynamic cost display** – show a *cost-per-second range* (low ↔︎ high) when a model’s price varies by resolution, powered by resolution-aware metadata (`phase3-cost-range-display`).

## 4. UX Improvement – Model Categorisation
To reduce dropdown fatigue the 24 logical models are now split into three groups:

| Bucket    | Rule / Cost Tier | Examples |
|-----------|------------------|----------|
| Premium   | > 20 credits or flagship | `veo3` (all), `kling-master` |
| Standard  | 9–20 credits | `seedance v1 pro`, `minimax hailuo-02 pro` |
| Budget    | ≤ 8 credits | `fast-svd`, `wan t2v 2.1`, `pixverse v4.5` |

The `VIDEO_MODELS` entries include a new `tier: "premium" | "standard" | "budget"` property consumed by the front-end to render grouped option lists.

## 5. Outstanding Work & Next Tasks
1. **Cost-range display** – implemented and shipped ✅
2. **Update tests** – align with new pricing & advanced-param flows ✅
3. **Wire field-support map** – `fal_input_groups.json` now covers all harvested models and UI heuristics have been removed ✅
4. **Docs & pricing** – refresh cost tables to match new credit rates (P1).
5. **Screenshot cleanup** – one-time batch complete; no ongoing CI work needed ✅

### New UI Tasks (2025-07-21 Evening Handoff)
* **Pricing comment realignment** – swap `costPerSecond` comment with `priceCostText` in `video-models.ts`; surface Fal’s price text under calculated cost range in UI. ✅
* **Model dropdown styling** – match padding/spacing to duration & aspect-ratio selects. ✅
* **Advanced Settings accordion** – rename to *Advanced Settings*, shift label left of caret, highlight entire header on hover/click.  ✅
* **Capability icons/labels** – add:
  * Start & End Frames for `wan-flf2v`
  * Effects
  * Lip-syncing (audio models)

---
*End of summary.* 