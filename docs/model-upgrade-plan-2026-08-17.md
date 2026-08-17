# Model Upgrade Plan — Tags, Options & Tooltips

**Date:** 2026-08-17  
**Scope:** Every model change from the audit, with exact tag/tooltip/option impacts  
**Status:** Plan only — no implementation yet

---

## Current System Map

### Video (src/app/dashboard/video/page.tsx)

**Tier grouping:** Budget / Standard / Premium (costPerSecond thresholds: <9 budget, ≥9 standard, >20 premium)

**Per-model icons in dropdown:**
- `Volume2` green = `model.hasAudio` → "Audio Lip-sync"
- `Film` purple = `falModelId.includes('wan-flf2v')` → "Start & End Frames"
- `Sparkles` pink = `falModelId.includes('pixverse')` → "Effects Parameter"
- `Clapperboard` blue = `falModelId.includes('kling-video')` → "Kling Extras"
- `Crown` yellow = `tierKey === 'premium'` → "Premium Tier"

**Details panel (below dropdown):**
- Max duration, cost/sec, gen time
- Kling badges: Camera Presets, Advanced Camera Control, Start & End Frames
- Pixverse badge: Effects
- WAN FLF2V badge: Start & End Frames
- Audio banner: "This model generates video with synchronized audio" (if `hasAudio`)

**Info tooltip (top of card):**
- "Veo 3: Generates video with synchronized audio / All other models: Video only"
- Camera Controls: presets, advanced, natural-language
- Key-frame Support: Kling 2.1/2.0/1.6
- Supported Models list

### Image (src/app/dashboard/generate/page.tsx)

- Simple dropdown, no per-model tooltips in selector
- Steps clamped: free model max 4 steps, paid max 50
- Premium badge component used on billing page

### Shared components

- `premium-model-badge.tsx` — Crown/Lock + "Pro" / "Upgrade"
- `tooltip.tsx`, `badge.tsx` — shadcn primitives

---

## Problems with Current System

1. **Audio tooltip is wrong now.** Says "Veo 3 has audio, all others don't." FLUX 3 also has audio.
2. **`hasAudio` field is binary.** FLUX 3 has `generate_audio` as an optional boolean (default true) — it's not always-on like Veo 3. The current `hasAudio: true/false` can't represent "audio optional."
3. **No "New" badge.** FLUX 3 is new — needs a visual indicator.
4. **No "Draft" indicator.** FLUX 3 has a draft mode (fast preview → enhance). No UI for this.
5. **Pricing model assumes single `costPerSecond`.** FLUX 3 has resolution-dependent pricing ($0.17 @720p vs $0.29 @1080p). Current `resolutionMultipliers` is a multiplier on a baseline — FLUX 3 needs absolute per-resolution costs.
6. **No 4K/Ultra badge for images.** FLUX.1-pro v1.1-ultra renders 2048x2048 — needs an "Ultra HD" tag.
7. **No context/multi-image badge.** FLUX.1-kontext supports up to 5 reference images — needs a tag.
8. **Kling 2.0 Master still listed.** Superseded by 2.1 Master at same cost.
9. **Fast SVD family has 5 variants.** All legacy, no audio. Only need 0-1.
10. **LTX 13B Dev same price as FLUX 3 but no audio.** Worth replacing.

---

## Planned Changes

### A. Add FLUX 3 Video Models

**New entries in VIDEO_MODELS:**

| id | falModelId | mode | costPerSecond | hasAudio | notes |
|---|---|---|---|---|---|
| `flux-3-text` | `blackforestlabs/flux-3/text-to-video` | text-to-video | 17 (720p) / 29 (1080p) | optional | resolution-dependent pricing |
| `flux-3-image` | `blackforestlabs/flux-3/image-to-video` | image-to-video | 17 / 29 | optional | |

**New fields needed on VideoModel:**
- `audioMode: 'always' | 'optional' | 'none'` — replaces `hasAudio: boolean`
  - `always` = Veo 3 (always generates audio)
  - `optional` = FLUX 3 (generate_audio boolean, default true)
  - `none` = everything else
- `resolutionPricing: Record<string, number>` — absolute cost per resolution (replaces multiplier for FLUX 3)
  - `{ "720p": 17, "1080p": 29 }`
- `draftSupport: boolean` — FLUX 3 has `/draft` endpoint
- `isNew: boolean` — triggers "NEW" badge

**Tags/tooltips for FLUX 3:**
- Dropdown: `Volume2` green (audio optional) + `Sparkles` (NEW badge)
- Tooltip: "FLUX 3: Native audio + lip sync, 5-20s, 720p/1080p"
- Details panel: "Audio: Optional (on by default)", "Draft mode: Yes", "Max 20s"
- Info tooltip update: Add FLUX 3 to audio section, update key-frame section

### B. Add FLUX.1-pro v1.1-ultra Image Model

**New entry in getAvailableModels() (together-ai.ts):**

| id | name | provider | credits | notes |
|---|---|---|---|---|
| `black-forest-labs/FLUX.1-pro-v1.1-ultra` | FLUX.1 Pro v1.1 Ultra | fal | ~10-15 cr | 2048x2048, image-conditioned |

**New fields needed:**
- `maxResolution: string` — "2048x2048" for ultra
- `supportsImagePrompt: boolean` — true for v1.1-ultra (has `image_url` + `image_prompt_strength`)
- `isUltra: boolean` — triggers "ULTRA HD" badge

**Tags/tooltips:**
- Dropdown: `Monitor` icon (4K) + "ULTRA HD" badge
- Tooltip: "2048x2048 — print-ready, image + text input"
- Details panel: "Max resolution: 2048x2048", "Image prompt: Yes"

### C. Add FLUX.1-kontext Image Models

**New entries:**

| id | name | provider | credits | notes |
|---|---|---|---|---|
| `black-forest-labs/FLUX.1-kontext` | FLUX.1 Kontext Pro | fal | ~8-10 cr | 5 reference images |
| `black-forest-labs/FLUX.1-kontext-max` | FLUX.1 Kontext Max | fal | ~10-15 cr | 5 ref images, max quality |

**New fields:**
- `maxReferenceImages: number` — 5 for kontext
- `supportsImagePrompt: boolean` — true
- `isContextModel: boolean` — triggers "CONTEXT" badge

**Tags/tooltips:**
- Dropdown: `Layers` icon + "CONTEXT" badge
- Tooltip: "Up to 5 reference images for style/character consistency"
- Details panel: "Reference images: Up to 5", "Best for: Style transfer, character consistency"

### D. Deprecate Models

**Remove from VIDEO_MODELS:**
- `kling-2.0-master-image` (superseded by 2.1 Master)
- `fast-svd`, `fast-svd-text`, `fast-svd-lcm`, `fast-svd-lcm-text` (keep only `stable-video-diffusion` as the free tier)
- `ltx-video-13b-dev-image` (replaced by FLUX 3)
- `kling-1.6-pro-image` (superseded by 2.1 Pro)

**Migration notes:**
- Users who selected a deprecated model should fall back to the cheapest model in the same mode
- API should reject deprecated model IDs with a clear error

### E. Update Existing Tags/Tooltips

**Info tooltip (video page):**
- Change "Veo 3: Generates video with synchronized audio" → "Veo 3 & FLUX 3: Generate video with synchronized audio"
- Change "All other models: Video only (no audio)" → "All other models: Video only"
- Add to Key-frame Support: "FLUX 3: first-last-frame-to-video endpoint"
- Add to Supported Models: "Black Forest Labs FLUX 3"

**Audio banner (details panel):**
- If `audioMode === 'always'`: "This model always generates synchronized audio"
- If `audioMode === 'optional'`: "This model can generate synchronized audio (toggle in advanced)"
- If `audioMode === 'none'`: no banner

**Tier grouping:**
- FLUX 3 @720p ($0.17/s) → Standard tier (cost 17, between Seedance Pro 19 and Kling 2.1 Master 35)
- FLUX 3 @1080p ($0.29/s) → Standard/Premium border (cost 29)
- FLUX.1-pro v1.1-ultra → Premium image tier

---

## Files to Change

| File | What |
|---|---|
| `src/lib/video-models.ts` | Add FLUX 3 entries, new fields (`audioMode`, `resolutionPricing`, `draftSupport`, `isNew`), remove deprecated |
| `src/lib/video-pricing.ts` | Handle `resolutionPricing` (absolute) vs `resolutionMultipliers` (relative) |
| `src/app/dashboard/video/page.tsx` | Update tier logic, icons, tooltips, details panel, info tooltip |
| `src/lib/together-ai.ts` | Add v1.1-ultra + kontext image models, new fields |
| `src/app/dashboard/generate/page.tsx` | Add image model dropdown tooltips, 4K badge, context badge |
| `src/components/billing/pricing-card.tsx` | No changes needed (plan-level, not model-level) |
| `src/components/ui/premium-model-badge.tsx` | Add variants for "NEW", "ULTRA HD", "CONTEXT" |

---

## New Badge Variants

| Badge | Icon | Color | Condition |
|---|---|---|---|
| NEW | Sparkles | Blue | `model.isNew` |
| ULTRA HD | Monitor | Purple | `model.isUltra` |
| CONTEXT | Layers | Orange | `model.isContextModel` |
| DRAFT | Clock | Green | `model.draftSupport` |

---

## Open Questions

1. **FLUX 3 pricing in credits.** FAL charges $0.17/s @720p. At 1 credit ≈ $0.01, that's 17 credits/s. But we currently mark up FAL costs (e.g., Seedance Pro FAL $0.124 → 19 cr/s = 1.5x markup). Should FLUX 3 use the same markup or be priced at cost?
2. **FLUX 3 draft mode.** Do we expose draft/enhance as a user-facing option, or just use it internally for faster previews?
3. **FLUX 3 resolution selector.** Currently resolution is a dropdown for models with `resolutionMultipliers`. FLUX 3 needs a 720p/1080p toggle that changes the cost. Should this be in the main form or advanced?
4. **Deprecation strategy.** Hard remove deprecated models, or keep them in the code but hidden with a "Legacy" tag?
5. **FLUX 3 first/last-frame and keyframes.** The audit recommends adding these. Should they be separate model entries (e.g., `flux-3-first-last-frame`) or modes within the FLUX 3 entry?

---

## Implementation Order

1. Update `video-models.ts` with new fields + FLUX 3 entries + remove deprecated
2. Update `video-pricing.ts` for resolution-dependent pricing
3. Update video page UI (tiers, icons, tooltips, details panel)
4. Update `together-ai.ts` for new image models
5. Update generate page UI for image badges
6. Add new badge component variants
7. Test all changes end-to-end
