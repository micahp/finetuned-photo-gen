# Full Model Audit — FAL State of the Art vs Current Lineup

**Date:** 2026-08-17  
**Scope:** Every image + video model in finetuned-photo-gen vs FAL's current catalog  
**Method:** OpenAPI specs pulled + test generations run from inside the production container  
**Key finding:** FLUX 3 is live (video), FLUX 3 image is NOT live yet, your image lineup is already optimal

---

## Test Results (2026-08-17, container finetuned-photo-gen-app-1)

Prompt: *"A cinematic shot of a red apple on a wooden table, dramatic lighting, shallow depth of field"*

### Image Models

| Model | FAL endpoint | Size | Time | Status |
|---|---|---|---|---|
| FLUX.1-schnell | fal-ai/flux/schnell | 1024x1024 | 1.7s | ✅ Excellent for fast tier |
| FLUX.1-dev | fal-ai/flux/dev | 1024x1024 | 2.7s | ✅ Best quality tier |
| FLUX.1-pro | fal-ai/flux-pro | 1024x1024 | 3.2s | ✅ Pro tier |
| FLUX.1-pro v1.1 | fal-ai/flux-pro/v1.1 | 1024x1024 | 4.7s | ✅ Latest pro |
| FLUX.1-pro v1.1-ultra | fal-ai/flux-pro/v1.1-ultra | 2048x2048 | 7.7s | ✅ Ultra (4MP) |

### FLUX 3 Video Models (NEW)

| Model | FAL endpoint | Output | Time | Status |
|---|---|---|---|---|
| FLUX 3 text-to-video | blackforestlabs/flux-3/text-to-video | 5s MP4 @720p | 56s | ✅ LIVE, audio optional |
| FLUX 3 image-to-video | blackforestlabs/flux-3/image-to-video | 5s MP4 @720p | 72s | ✅ LIVE, audio optional |

---

## Visual Analysis Summary

**FLUX.1-schnell** — Very good for a fast model. Coherent lighting, plausible DOF/bokeh, minor wood texture smudging. At $0.003/img, this is the right free/turbo tier.

**FLUX.1-dev** — Noticeable quality bump over schnell: smoother lighting transitions, more natural subsurface scattering on the apple, better wood grain. Worth the 8x cost for final renders.

**FLUX.1-pro** — Professional-grade. Rembrandt-style lighting, extremely shallow DOF with creamy bokeh, tight sharpness on skin texture, cinematic color grading (warm ambers vs cool teals). Indistinguishable from high-end food photography.

**FLUX.1-pro v1.1** — Similar quality to pro but slightly more consistent. Same resolution, slightly slower. Your best 1024px option.

**FLUX.1-pro v1.1-ultra** — 2048x2048 (4MP). Prints up to 13x13" at 150 DPI without upscaling. The extra resolution is visible in the fine detail: individual lenticels (pores) on the apple skin are crisp. Worth $0.06 for print or high-res delivery.

**FLUX 3 text-to-video** — Smooth 5-second clip. No audio in test (generate_audio=false), but the endpoint supports it natively. Apple rotation was coherent, lighting consistent throughout. ~56s total.

**FLUX 3 image-to-video** — Successfully animated a still image of an apple. Smooth motion. ~72s total.

---

## FLUX 3 Deep Dive

### What's LIVE on FAL (2026-08-17)

| Endpoint | Mode | Duration | Audio | Price |
|---|---|---|---|---|
| blackforestlabs/flux-3/text-to-video | Text → Video | 5-20s @720p/1080p | ✅ Native | $0.17/s @720p, $0.29/s @1080p |
| blackforestlabs/flux-3/image-to-video | Image → Video | 5-20s | ✅ Native | Same |
| blackforestlabs/flux-3/first-last-frame-to-video | First+Last frame → Video | 5-20s (explicit) | ✅ | Same |
| blackforestlabs/flux-3/keyframes-to-video | Up to 10 keyframes → Video | 5-20s (explicit) | ✅ | Same |
| blackforestlabs/flux-3/extend-video | Video extension | 5-20s | ✅ | $0.41/s @720p, $0.53/s @1080p |
| /draft variants | Fast preview | 5-20s | ✅ | Cheaper |

### FLUX 3 Image Generation: NOT LIVE

BFL has announced FLUX 3 image generation and editing, but only the video endpoints are live on FAL. The text-to-image endpoint accepts the submit but returns 404 on completion.

### FLUX 3 Input Schema (key fields)

- `prompt` (required)
- `duration` (5-20s, explicit for frames/keyframes, auto for text/image)
- `aspect_ratio` (auto, 21:9, 2:1, 16:9, 4:3, 1:1, 3:4, 9:16)
- `resolution` (720p / 1080p)
- `generate_audio` (default: True — FLUX 3's unique selling point)
- `safety_tolerance` (0=strict, 4=permissive, default=2)

### How FLUX 3 slots into your video lineup

| Model | FAL cost/s | Audio | Notes |
|---|---|---|---|
| Seedance 1.0 Lite | $0.036 | 🚫 | Your budget |
| Seedance 1.0 Pro | $0.124 | 🚫 | |
| **FLUX 3 @720p** | **$0.17** | **✅** | Native audio + lip sync |
| Kling 2.1 Pro | $0.09 | 🚫 | |
| Kling 2.1 Master | $0.28 | 🚫 | |
| Veo 3 Fast | $0.40 | ✅ | |
| Veo 3 | $0.75 | ✅ | Your premium |

At $0.17/s, a 5-second FLUX 3 clip costs $0.85. The differentiator is native audio — it's the first mid-tier model that generates synchronized sound.

---

## Image Spec Differences (What Each Model Adds)

| Field | schnell | dev | pro | pro v1.1 | pro v1.1-ultra | kontext |
|---|---|---|---|---|---|---|
| acceleration | ✅ | ✅ | — | — | — | — |
| enhance_prompt | — | — | ✅ | ✅ | ✅ | ✅ |
| guidance_scale | ✅ | ✅ | ✅ | — | — | ✅ |
| image_size / aspect_ratio | ✅ | ✅ | ✅ | ✅ | ✅ (ratio) | ✅ |
| image_url | — | — | — | — | ✅ | — |
| image_prompt_strength | — | — | — | — | ✅ (0-1) | — |
| loras | — | — | — | — | — | — |
| num_inference_steps | ✅ (def 4) | ✅ (def 28) | ✅ (def 28) | — | — | — |
| output_format | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| raw | — | — | — | — | ✅ (natural look) | — |
| safety_tolerance | — | — | ✅ (1-6) | ✅ (1-6) | ✅ (1-6) | ✅ (1-6) |
| sync_mode | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Key difference: `v1.1-ultra` adds `image_url` + `image_prompt_strength` for image-conditioned generation, and `raw` mode for more natural (less processed) outputs. `kontext` variants add `aspect_ratio` to pro.

---

## Recommendations

### Add

1. **FLUX 3 text-to-video** — New tier between Seedance Pro and Kling 2.1 Master. $0.17/s, native audio. Suggested credit price: ~25 cr/s.
2. **FLUX 3 image-to-video** — Same tier, image-conditioned. 
3. **FLUX 3 first/last-frame-to-video** — For storyboard-style generation.
4. **FLUX.1-pro v1.1-ultra** as "4K/Ultra" tier — 2048x2048 for print/high-res delivery. At $0.06/img it's premium but justified.

### Deprecate / Consolidate

1. **Kling 2.0 Master** — Superseded by Kling 2.1 Master at same $0.28/s cost. No reason to keep both.
2. **Fast SVD family (5 variants)** — Legacy, ultra-cheap, no audio. If you want a free/tier-1 video option, keep one (e.g. stable-video-diffusion at $0.0011/s). Cut the rest.
3. **LTX 13B Dev** — Same price as FLUX 3 @720p ($0.20 vs $0.17) but no audio. Replace when FLUX 3 lands.
4. **Kling 1.6 Pro** — Superseded by Kling 2.1 Pro. Same lineage, newer version is better.

### Keep As-Is

- **FLUX.1 schnell/dev/pro** image trio — Already optimal. No FAL alternative is better at these price points.
- **FLUX.1-pro v1.1** — Keep as the standard pro tier.
- **Seedance 1.0 Lite/Pro** — Best budget/mid options, no audio but fast and reliable.
- **Hailuo 02 Standard/Pro** — Competitive pricing, good quality.
- **Veo 3 / Veo 3 Fast** — Your premium audio tier. FLUX 3 is mid-tier; Veo stays premium.
- **Kling 2.1 Master/Pro/Standard** — Solid lineup with good quality options.
- **WAN 2.1 / WAN FLF2V** — Strong motion diversity.
- **Pixverse v4.5** — Effects/transition/standard modes cover creative use cases.

---

## Pricing Summary (your cost to FAL)

### Image (per image)

| Tier | Model | FAL cost | You should charge |
|---|---|---|---|
| Free | FLUX.1-schnell | $0.003 | ~1 cr |
| Fast | FLUX.1-schnell | $0.003 | ~1 cr |
| Standard | FLUX.1-dev | $0.025 | ~3-5 cr |
| Pro | FLUX.1-pro v1.1 | $0.05 | ~8-10 cr |
| Ultra | FLUX.1-pro v1.1-ultra | $0.06 | ~10-15 cr |

### Video (per second)

| Tier | Model | FAL cost/s | Audio | You should charge |
|---|---|---|---|---|
| Budget | Stable Video Diffusion | $0.0011 | 🚫 | ~3 cr/s |
| Budget | Seedance 1.0 Lite | $0.036 | 🚫 | ~7 cr/s |
| Mid | Seedance 1.0 Pro | $0.124 | 🚫 | ~19 cr/s |
| **NEW Mid+Audio** | **FLUX 3 @720p** | **$0.17** | **✅** | **~25 cr/s** |
| Mid | Kling 2.1 Master | $0.28 | 🚫 | ~35 cr/s |
| Premium | Veo 3 Fast | $0.40 | ✅ | ~50 cr/s |
| Premium | Veo 3 | $0.75 | ✅ | ~80 cr/s |

---

## Specs Location

All OpenAPI specs pulled to: `scripts/fal_api_specs/`

- FLUX 3 specs: `blackforestlabs_flux-3_*.json` (6 endpoints)
- FLUX.1 image specs: `fal-ai_flux_*.json` (6 endpoints)
- All existing video specs: already in repo (35 files)

Specs pulled 2026-08-17 via `scripts/pull_missing_fal_specs.py`.
