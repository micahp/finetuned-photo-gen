### Video-model pricing audit (2025-07-20)

Context: we just synced every `falModelId` in `src/lib/video-models.ts` with live Fal.ai endpoints and updated `scripts/get_fal_models_helper_functions.py` so it contains baseline Fal pricing (`video_second` in USD) for each endpoint.

The next task is to reconcile **our internal `costPerSecond` values (credits/s)** with those Fal baseline prices and agree on a consistent markup policy.

---

#### Key numbers & assumptions

* 1 credit ≈ **$0.01** (hard-coded across the app).
* Baseline prices in the helper are plain Fal.ai list prices (USD per video-second).
* A _markup factor_ = `costPerSecond / (baselinePrice/0.01)`  
  ‑ e.g. Fal 0.28 $/s → 28 credits / 42 credits coded → **1.5×** markup.

#### Script snapshot

Running `scripts/verify_video_models.py` after the pricing update:

```
Endpoints without spec: 0 ✅
Mismatches (26 models) – table below
```

| id | Fal ¢/s | coded credits/s | implied markup |
|----|--------:|----------------:|---------------:|
| hailuo-02-standard-image | 4.5 | 8 | **1.78×** |
| hailuo-02-standard-text | 4.5 | 8 | 1.78× |
| hailuo-02-pro-* | 8 | 12 | **1.5×** |
| veo-3-text | 75 | 80 | **1.07×** |
| veo-3-fast-text | 40 | 50 | **1.25×** |
| veo-2-* | 50 | 55 | **1.1×** |
| kling-2.1-master-image | 28 | 35 | **1.25×** |
| kling-2.1-pro-image | 9 | 16 | **1.78×** |
| kling-2/master-image | 28 | 42 | **1.5×** |
| pixverse-v4.5-* | 8 | 14 | **1.75×** |
| hunyuan-custom-512 | 16 | 24 | **1.5×** |
| hunyuan-avatar | 28 | 42 | **1.5×** |
| magi-1 | 28 | 35 | **1.25×** |
| fast-svd* | 1.5 | 3 | **2.0×** |
| wan-2.1-* | 4 | 8 | **2.0×** |
| ltx-video-13b-dev | 20 | 25 | **1.25×** |
| ltx-video-v095* | 2 | 3–8 | **1.5× – 4×** |
| … | … | … | … |

*(see `/tmp/verify_output3.json` for full list)*

---

#### Observations

1. **Markup isn’t uniform** – we see 1.07× → 2× across models.
2. Common clusters: 1.25×, 1.5×, 1.75–1.8×, and a few edge (2×).
3. Comments in `video-models.ts` often mention the intended markup (e.g. “markup ×1.75”). A few comments & values drifted (Hailuo Standard now 1.78× after price drop).
4. Some _very cheap_ models (≤ 2 ¢/s) were doubled to hit a 3 credit minimum.

---

#### Questions / TODO for next session

1. **Define a policy**  
   • flat markup (e.g. 1.5× everywhere)?  
   • tiered (cheap models ≥ credits-floor; high-end audio models lower markup)?
2. Decide if we keep comments & scripted pricing in sync automatically (CI lint) or manual review.
3. Update `costPerSecond` where markup deviation > 0.1× from chosen rule.
4. Consider dynamic env-based multiplier (`VIDEO_PRICING_MULTIPLIER`) already supported – document procedure.
5. Add unit tests around `verify_video_models.py` so it fails CI on unsupported drift.

---

_This file is a hand-off; next developer can pick a markup scheme, adjust the numbers, and wire a CI guard._ 