# Model Audit — FAL State of the Art vs Current Lineup

**Date:** 2026-08-17  
**Scope:** All image + video models in finetuned-photo-gen vs what FAL currently offers  
**Goal:** Identify upgrades, dead weight, and gaps

---

## Image Models

### Current Lineup

| Model | FAL Endpoint | FAL cost/img | You charge | Status |
|---|---|---|---|---|
| FLUX.1-schnell-Free | fal-ai/flux/schnell | $0.003 | 1 credit (effectively free tier) | ✅ Best for free/turbo |
| FLUX.1-schnell (Turbo) | fal-ai/flux/schnell | $0.003 | credits | ✅ Best for fast |
| FLUX.1-dev | fal-ai/flux/dev | $0.025 | credits | ✅ Best for quality |
| FLUX.1-pro | Replicate (black-forest-labs/flux-pro) | $0.055 | credits | ⚠️ Legacy but works |
| FLUX1.1-pro | Replicate (black-forest-labs/flux-1.1-pro) | ~$0.04–0.05 | credits | ✅ Your best |

### FAL's Latest — FLUX 3 Image

**Status: NOT LIVE.** Black Forest Labs announced FLUX 3 image generation (improved prompt following, multilingual text rendering, open-weight Dev release planned) but as of 2026-08-17, only the video endpoints are live on FAL. The text-to-image endpoint accepts jobs but returns 404 on completion.

**Verdict:** No upgrade path for images yet. Your FLUX.1 lineup is already the best FAL offers.

---

## Video Models

### Current Lineup vs FAL Cost

| Model | FAL cost/s | You charge (credits) | Audio | FAL status |
|---|---|---|---|---|
| Stable Video Diffusion (i2v) | $0.0011 | 3 cr/s | 🚫 | Legacy |
| Fast SVD (i2v) | $0.0011 | 2 cr/s | 🚫 | Legacy |
| Fast SVD (t2v) | $0.0011 | 2 cr/s | 🚫 | Legacy |
| Fast SVD LCM (i2v) | $0.0011 | 3 cr/s | 🚫 | Legacy |
| Fast SVD LCM (t2v) | $0.0011 | 3 cr/s | 🚫 | Legacy |
| SVD (t2v) | $0.00003/compute-s | 1 cr/s | 🚫 | Legacy |
| LTX 13B 0.9.8 Distilled (i2v) | $0.02 | 5 cr/s | 🚫 | Current |
| LTX 13B 0.9.8 MC (i2v) | $0.02 | 5 cr/s | 🚫 | Current |
| LTX 13B 0.9.8 Distilled (t2v) | $0.02 | 5 cr/s | 🚫 | Current |
| LTX 13B Dev (i2v) | $0.20 | 25 cr/s | 🚫 | Current |
| Pixverse v4.5 (i2v) | $0.15–0.40 | 20 cr/s | 🚫 | Current |
| Pixverse v4.5 (t2v) | $0.15–0.40 | 20 cr/s | 🚫 | Current |
| Pixverse v4.5 Effects | $0.15–0.40 | 20 cr/s | 🚫 | Current |
| Pixverse v4.5 Transition | $0.15–0.40 | 20 cr/s | 🚫 | Current |
| Seedance 1.0 Lite (i2v) | $0.036 | 7 cr/s | 🚫 | Current |
| Seedance 1.0 Lite (t2v) | $0.036 | 7 cr/s | 🚫 | Current |
| Hailuo 02 Standard (i2v) | $0.045 | 8 cr/s | 🚫 | Current |
| Hailuo 02 Standard (t2v) | $0.045 | 8 cr/s | 🚫 | Current |
| Hunyuan Custom 512p | $0.16 | 24 cr/s | 🚫 | Current |
| Hailuo 02 Pro (i2v) | $0.08 | 12 cr/s | 🚫 | Current |
| Hailuo 02 Pro (t2v) | $0.08 | 12 cr/s | 🚫 | Current |
| MiniMax Video-01 (t2v) | — | 12 cr/s | 🚫 | Current |
| MiniMax Video-01 Live (i2v) | — | 12 cr/s | 🚫 | Current |
| Seedance 1.0 Pro (i2v) | $0.124 | 19 cr/s | 🚫 | Current |
| Seedance 1.0 Pro (t2v) | $0.124 | 19 cr/s | 🚫 | Current |
| MAGI-1 (t2v) | $0.28 | 35 cr/s | 🚫 | Current |
| Kling 2.1 Standard (i2v) | $0.08 | 14 cr/s | 🚫 | Current |
| Kling 1.6 Pro (i2v) | $0.095 | 17 cr/s | 🚫 | Current |
| WAN 2.1 (i2v) | $0.04/5s | 25 cr/s | 🚫 | Current |
| WAN 2.1 (t2v) | $0.04/5s | 25 cr/s | 🚫 | Current |
| WAN FLF2V | $0.04/5s | 25 cr/s | 🚫 | Current |
| Kling 2.1 Pro (i2v) | $0.09 | 16 cr/s | 🚫 | Current |
| Kling 2.1 Master (i2v) | $0.28 | 35 cr/s | 🚫 | Current |
| Kling 2.0 Master (i2v) | $0.28 | 42 cr/s | 🚫 | Current |
| Veo 2 (t2v) | $0.50 | 55 cr/s | 🚫 | Current |
| Veo 2 (i2v) | $0.50 | 55 cr/s | 🚫 | Current |
| Veo 3 Fast (t2v) | $0.40 | 50 cr/s | ✅ | Current |
| Veo 3 (t2v) | $0.75 | 80 cr/s | ✅ | Current |

### 🆕 FLUX 3 Video — LIVE on FAL

**Endpoints (all live, verified 2026-08-17):**
- `blackforestlabs/flux-3/text-to-video`
- `blackforestlabs/flux-3/image-to-video`
- `blackforestlabs/flux-3/first-last-frame-to-video`
- `blackforestlabs/flux-3/keyframes-to-video`
- `blackforestlabs/flux-3/extend-video`
- Plus `/draft` variants + `draft-enhance`

**Pricing:**
- Core endpoints (text/image/frames/keyframes): **$0.17/s @720p, $0.29/s @1080p**
- Extend Video: **$0.41/s @720p, $0.53/s @1080p**
- Drafts (preview renders): cheaper, fast, reusable cache

**What it brings that nobody else at this price does:**
- Native audio generation synchronized to lip movement
- Audio effects synchronized to physical events
- Draft workflow (preview fast, enhance at full quality)

**Where it slots in your lineup:**

| Comparison | FAL cost/s | Audio |
|---|---|---|
| Seedance 1.0 Pro | $0.124 | 🚫 |
| **FLUX 3 @720p** | **$0.17** | **✅** |
| Kling 2.1 Master | $0.28 | 🚫 |
| MAGI-1 | $0.28 | 🚫 |
| FLUX 3 @1080p | $0.29 | ✅ |

At $0.17/s, a 5-second FLUX 3 clip costs $0.85 — between Seedance Pro ($0.62) and Kling 2.1 Master ($1.40). The differentiator is audio: FLUX 3 is the first mid-tier model that generates synchronized sound, which none of your current mid-tier options can do.

**Verdict: Add FLUX 3 as a new tier.** It's not a replacement — it's a new category (mid-tier + audio).

---

## Summary & Recommendations

### Image
- **No upgrade available.** FLUX 3 image generation is announced but not live on FAL.
- Your FLUX.1 schnell → dev → pro lineup is already optimal for each tier.
- Action: None.

### Video
- **Add FLUX 3** between Seedance 1.0 Pro and Kling 2.1 Master.
- It fills a genuine gap: first mid-tier model with native audio + lip sync.
- Suggested credit pricing: ~25–30 credits/s (between Seedance Pro's 19 and Kling 2.1 Master's 35).
- Supports text-to-video and image-to-video on day one; first/last-frame, keyframes, and extend can follow.

### Dead Weight to Consider Cutting
- **Kling 2.0 Master** ($0.28/s, 42 cr/s) — superseded by Kling 2.1 Master at same FAL cost. No reason to keep both.
- **Fast SVD family** (5 variants, all $0.0011/s) — legacy, ultra-cheap, no audio. If you want a free/tier-1 video option, keep one. The rest are redundant.
- **LTX 13B Dev** ($0.20/s, 25 cr/s) — same price as FLUX 3 @720p but no audio. Likely worth replacing when FLUX 3 lands.

---

## Methodology

- FAL costs pulled from official model pages on fal.ai (2026-08-17).
- FLUX 3 verified live via real job submission through the @fal-ai/client in the production container.
- FLUX 3 image verified NOT live: text-to-image endpoint accepts the submit but returns 404 on completion (client confirms "Not Found").
- Your credit costs from src/lib/video-models.ts and src/lib/video-pricing.ts.
