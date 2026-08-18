# Roadmap & Backlog

**Last updated:** 2026-08-17

---

## In Progress

### Model Upgrade — FLUX 3 + Next-Gen FAL Models

Adding new models from the FAL audit, deprecating superseded ones, updating tags/tooltips/options.

**Key decisions:**
- FLUX 3: 1.5x markup (25 cr/s @720p), draft mode internal-only, 1080p as checkbox (+12 cr/s)
- FLUX.1-pro v1.1-ultra + kontext: New image tiers
- Deprecated models: Keep in code, greyed-out in UI with warning banner

**Files:**
- `src/lib/video-models.ts` — FLUX 3 entries, new fields, deprecation flags
- `src/lib/video-pricing.ts` — Resolution-dependent pricing
- `src/app/dashboard/video/page.tsx` — UI updates (badges, tooltips, audio logic)
- `src/lib/together-ai.ts` — New image models + fields
- `src/app/dashboard/generate/page.tsx` — Image model badges
- `src/components/ui/premium-model-badge.tsx` — NEW/ULTRA/CONTEXT variants

---

## Backlog

### Model Features
- [ ] FLUX 3 first/last-frame-to-video (separate entry, start/end frame upload)
- [ ] FLUX 3 keyframes-to-video (up to 10 keyframes)
- [ ] FLUX 3 extend-video (continue from existing clip)
- [ ] FLUX 3 draft/enhance pipeline (internal preview → enhance)
- [ ] FLUX.1-kontext reference image upload (up to 5 images)
- [ ] FLUX.1-pro v1.1-ultra image prompt UI (image_url + strength slider)

### Pricing & Credits
- [ ] Review credit markup consistency across all models (standardize to 1.5x)
- [ ] FLUX.1-kontext pricing (FAL: $0.05-0.06/img → credits TBD)
- [ ] Resolution-dependent pricing UI for video (toggle vs dropdown)
- [ ] "Upgrade to 1080p" checkbox for FLUX 3

### Deprecation Cleanup
- [ ] Hard-remove deprecated models (Kling 2.0, Fast SVD family, LTX 13B Dev, Kling 1.6)
- [ ] Add deprecation banner to video page
- [ ] API migration guide for deprecated model IDs

### UI/UX
- [ ] Model comparison page (side-by-side visual examples)
- [ ] "Why this model?" explainer tooltips on each option
- [ ] Generation time estimates per model
- [ ] Show FAL real cost vs credit cost in advanced view

---

## Done

- [x] Model audit: full sweep of image + video lineup vs FAL state-of-the-art (2026-08-17)
- [x] FLUX 3 video confirmed live on FAL (text + image endpoints)
- [x] OpenAPI specs pulled for all new models (22 endpoints)
- [x] Test generations run + visual analysis of all image tiers

---

## Notes

- FLUX 3 image generation is NOT live on FAL yet (announced, planned). Revisit quarterly.
- Re-run `scripts/pull_missing_fal_specs.py` when FAL adds new endpoints.
- Credit pricing should be reviewed monthly against FAL cost changes.
