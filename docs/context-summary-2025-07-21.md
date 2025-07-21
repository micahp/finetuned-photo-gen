# Finetuned-Image-Gen – Context Summary (2025-07-21)
This document rolls up **all work completed on July-21** and revises the roadmap based on three new decisions:

* **Param-Group Harvester** – see `decisions/fal-param-group-harvester-2025-07-21.md`.
* **Playground Screenshot Automation** – see `decisions/fal-playground-screenshots-2025-07-21.md`.
* **Resolution-Aware Pricing Metadata** – see `decisions/resolution-pricing-metadata-2025-07-21.md`.

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
* Parameter grouping metadata (`above`, `advanced`) exported to `fal_input_groups.json` for form generation.
* **Above-the-fold vs Advanced UI** – the grouping mirrors Fal’s own layout: the first ~5 “core” controls appear immediately, while less-used fields tuck under an **Advanced** accordion. The JSON drives our React form to collapse these fields by default.

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

## 4. UX Improvement – Model Categorisation
To reduce dropdown fatigue the 24 logical models are now split into three groups:

| Bucket    | Rule / Cost Tier | Examples |
|-----------|------------------|----------|
| Premium   | > 20 credits or flagship | `veo3` (all), `kling-master` |
| Standard  | 9–20 credits | `seedance v1 pro`, `minimax hailuo-02 pro` |
| Budget    | ≤ 8 credits | `fast-svd`, `wan t2v 2.1`, `pixverse v4.5` |

The `VIDEO_MODELS` entries include a new `tier: "premium" | "standard" | "budget"` property consumed by the front-end to render grouped option lists.

## 5. Outstanding Work & Next Tasks
1. **UI forms upgrade** – surface new params, fold logic, tiered dropdown (P0).
2. **Update tests** – cover new params & tier logic (P0).
3. **Docs & pricing** – refresh cost table, flag TBD rows (P1).
4. **CI enhancement** – compress screenshot artefacts or move to LFS (P2).

---
*End of summary.* 