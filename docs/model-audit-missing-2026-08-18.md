# FAL Model Audit — Full Catalog Scan (2026-08-18)

**Scope:** FAL's full 40-model catalog vs our current lineup
**Method:** Pulled FAL's /api/models, tested all new endpoints, verified schemas
**Goal:** Find every model we're missing — not just verify what we have

---

## What We Were Missing

### Image Models (not in app)

| FAL ID | Model | Price | Notes |
|---|---|---|---|
| fal-ai/flux-2-pro | Flux 2 Pro | TBD | New gen FLUX, improved quality |
| fal-ai/flux-2/klein/9b | FLUX.2 Klein 9B | TBD | Small/fast variant |
| fal-ai/flux-lora | FLUX.1 dev + LoRAs | TBD | Custom LoRA inference |
| openai/gpt-image-2 | GPT Image 2 | TBD | OpenAI's latest image gen |
| openai/gpt-image-2/edit | GPT Image 2 Edit | TBD | OpenAI's latest image edit |

### Video Models (not in app)

| FAL ID | Model | Price | Notes |
|---|---|---|---|
| bytedance/seedance-2.0/text-to-video | Seedance 2.0 Text | TBD | Supersedes 1.0 |
| bytedance/seedance-2.0/image-to-video | Seedance 2.0 Image | TBD | Supersedes 1.0 |
| bytedance/seedance-2.0/reference-to-video | Seedance 2.0 Reference | TBD | New mode (style transfer) |
| bytedance/seedance-2.5/text-to-video | Seedance 2.5 Text | TBD | Latest, 30s clips |
| bytedance/seedance-2.5/image-to-video | Seedance 2.5 Image | TBD | Latest, 30s clips |
| bytedance/seedance-2.5/reference-to-video | Seedance 2.5 Reference | TBD | New mode |
| fal-ai/kling-video/v3/pro/image-to-video | Kling 3 Pro | TBD | Supersedes 2.1 |
| fal-ai/kling-video/v3/standard/image-to-video | Kling 3 Standard | TBD | Supersedes 2.1 |
| fal-ai/kling-video/v2.5-turbo/pro/image-to-video | Kling 2.5 Turbo Pro | TBD | Faster/cheaper |
| fal-ai/kling-video/v2.6/pro/image-to-video | Kling 2.6 Pro | TBD | Latest Kling |

---

## Planned Implementation

### Add (14 new models)

**Image:**
- Flux 2 Pro, FLUX.2 Klein 9B, GPT Image 2, GPT Image 2 Edit, FLUX.1 dev + LoRAs

**Video:**
- Seedance 2.0 (text, image, reference)
- Seedance 2.5 (text, image, reference)
- Kling v3 Pro + Standard
- Kling v2.5 Turbo Pro + v2.6 Pro

### Deprecate (after migration)
- Seedance 1.0 Pro/Lite (superseded by 2.0/2.5)
- Kling 2.1 Pro/Standard (superseded by v3)

### Specs Pulled
All 14 OpenAPI specs saved to `scripts/fal_api_specs/`:
- bytedance_seedance-2.0_text-to-video.json
- bytedance_seedance-2.0_image-to-video.json
- bytedance_seedance-2.0_reference-to-video.json
- bytedance_seedance-2.5_text-to-video.json
- bytedance_seedance-2.5_image-to-video.json
- bytedance_seedance-2.5_reference-to-video.json
- fal-ai_kling-video_v3_pro_image-to-video.json
- fal-ai_kling-video_v3_standard_image-to-video.json
- fal-ai_kling-video_v2.5-turbo_pro_image-to-video.json
- fal-ai_kling-video_v2.6_pro_image-to-video.json
- fal-ai_flux-2-pro.json
- fal-ai_flux-2_klein_9b.json
- openai_gpt-image-2.json
- openai_gpt-image-2_edit.json

---

## Pricing Research Needed

FAL's /api/models endpoint doesn't return pricing. Need to check each model page individually or use the queue's response after a test generation. All prices marked TBD until confirmed.

---

## Implementation Order

1. Update video-models.ts: Add Seedance 2.0/2.5 + Kling v3/v2.5/v2.6 entries
2. Update together-ai.ts: Add Flux 2 Pro, FLUX.2 Klein, GPT Image 2, GPT Image 2 Edit
3. Update fal-image-service.ts: Add FAL routing for new image models
4. Update video page UI: Add new models to dropdown with proper grouping
5. Update generate page UI: Add new image models with badges
6. Test all changes end-to-end
