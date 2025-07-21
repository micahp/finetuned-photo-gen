# Finetuned-Image-Gen – Context Summary (2025-07-21)
This document rolls up **all work completed on July-21** and revises the roadmap based on two new decisions:

* **Param-Group Harvester** – see `decisions/fal-param-group-harvester-2025-07-21.md`.
* **Playground Screenshot Automation** – see `decisions/fal-playground-screenshots-2025-07-21.md`.

---

## 1. Status Snapshot
✔️ **Phase 1 – Model Catalogue Automation** – completed yesterday, CI diff tooling live.
✔️ **Phase 2 – `VIDEO_MODELS` Table Refresh** – all eight missing endpoints added, six enums corrected.
➜ **Phase 3 – `FalVideoService` Extensions** – re-scoped today (details §3).

New assets/directories introduced today:
1. `scripts/fal_api_specs/` – canonical OpenAPI specs (now **30** files).
2. `shots/` – auto-captured before/after screenshots for every Fal model.

## 2. Data Integrity Work
The harvester script now cross-references **spec JSON → Playground UI → `VIDEO_MODELS`** to ensure:
* Correct **`falModelId`** & **mode** for all 30 endpoints.
* Up-to-date enum lists (`aspect_ratio`, `duration`).
* Parameter grouping metadata (`above`, `advanced`) exported to `fal_input_groups.json` for form generation.

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

## 4. UX Improvement – Model Categorisation
To reduce dropdown fatigue the 24 logical models are now split into three groups:

| Bucket    | Rule / Cost Tier | Examples |
|-----------|------------------|----------|
| Premium   | > 20 credits or flagship | `veo3` (all), `kling-master` |
| Standard  | 9–20 credits | `seedance v1 pro`, `minimax hailuo-02 pro` |
| Budget    | ≤ 8 credits | `fast-svd`, `wan t2v 2.1`, `pixverse v4.5` |

The `VIDEO_MODELS` entries include a new `tier: "premium" | "standard" | "budget"` property consumed by the front-end to render grouped option lists.

## 5. Outstanding Work & Next Tasks
1. **Phase 3 coding** – extend `FalVideoService` & types (P0).
2. **Dropdown refactor** – implement grouped select component (P0).
3. **Update tests** – cover new params & tier logic (P0).
4. **Docs & pricing** – refresh cost table, flag TBD rows (P1).
5. **CI enhancement** – compress screenshot artefacts or move to LFS (P2).

---
*End of summary.* 