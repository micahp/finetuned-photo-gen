🔮 LTX‑Video 13B 0.9.8 Distilled --- Prompt‑Crafting Playbook
-----------------------------------------------------------

*(covers **Text → Video** & **Image → Video** on Fal.ai / Hugging Face)*

* * * * *

### 1\. Know the Model's "Comfort Zone"

| Category | Sweet‑spot value(s) | Why it matters | Source |
| --- | --- | --- | --- |
| **Resolution** | ≤ 1280 × 720 ("720p") | Larger frames pad/crop to a multiple of 32; quality gains flatten above 720p --- small files render faster | ([Hugging Face](https://huggingface.co/Lightricks/LTX-Video?utm_source=chatgpt.com "Lightricks/LTX-Video - Hugging Face")) |
| **Frame count** | Numbers of the form **8 n + 1** (e.g. 121, 129, 161) | Network was trained on blocks divisible by 8 plus 1; off‑pattern counts are padded then cropped, wasting cycles | ([Hugging Face](https://huggingface.co/Lightricks/LTX-Video?utm_source=chatgpt.com "Lightricks/LTX-Video - Hugging Face"), [GitHub](https://github.com/Lightricks/LTX-Video?utm_source=chatgpt.com "Lightricks/LTX-Video: Official repository for LTX-Video - GitHub")) |
| **FPS** | 24 (default) | Keeps motion natural while staying cost‑efficient | ([Fal.ai](https://fal.ai/models/fal-ai/ltxv-13b-098-distilled/image-to-video/api "LTX-Video 13B 0.9.8 Distilled | Image to Video | fal.ai")) |
| **Cost** | $0.02 / sec, doubled if `enable_detail_pass=true` | Budget planning & UX messaging | ([Fal.ai](https://fal.ai/models/fal-ai/ltxv-13b-098-distilled "LTX-Video 13B 0.9.8 Distilled | Text to Video | fal.ai")) |

> **Quick recipe for a 5 s clip** → `720p`, `num_frames: 121`, `frame_rate: 24`.

* * * * *

### 2\. Prompt Anatomy (Text → Video)

1.  **Scene lead‑in** -- One vivid sentence that stakes out *where* and *what* (e.g., "A rain‑soaked neon alley in near‑future Tokyo...").

2.  **Action line** -- Describe motion **before** camera moves ("...a cyber‑witch launches a glowing sigil skyward...").

3.  **Camera choreography** -- Use film verbs: *dolly, orbit, tilt, crane, push‑in*.

4.  **Lighting & FX** -- Name light source, time‑of‑day, smoke, sparks, etc.

5.  **Style tags** -- "hyper‑realistic 4 K film, shallow depth‑of‑field, subtle lens‑flare".

6.  **Counts & colours** -- Explicit numbers ("six cars") and unique palettes reduce duplicates.

7.  **Negative prompt** -- Always include blur/jitter/watermark blockers.

> **Template**

```
<Scene & Mood>. <Key Subject> performs <Action>.
Camera: <move‑1>, then <move‑2>.
Style: <lighting>, <FX>, <cinematic descriptors>.

```

* * * * *

### 3\. Prompt Anatomy (Image → Video)

*All of the above **plus**:*

| Field | Best practice |
| --- | --- |
| `image_url` | Use 16:9 or 1:1 source that *already* matches your composition. Avoid blank borders. |
| `strength` (0 -- 1) | 0.3‑0.6 retains identity; > 0.7 re‑stylises heavily. |
| `constant_rate_factor` | 25‑29 usually enough; lower for pristine inputs. |

* * * * *

### 4\. Parameter Cheatsheet

| Parameter | Typical Values | Tips |
| --- | --- | --- |
| `num_frames` | 121 (5 s), 241 (10 s) | Must be 8 n + 1. |
| `resolution` | `"720p"` or `"480p"` | JSON enums only; don't free‑type "1080p". |
| `aspect_ratio` | `"16:9"`, `"9:16"`, `"1:1"`, `"auto"` | Matches mobile/desktop canvases. |
| `enable_detail_pass` | `true / false` | 2× cost; cleans edges & motion. |
| `expand_prompt` | `false` | Let **you** control wording; true lets an LLM re‑write. |
| `seed` | `integer` | Fix for deterministic demos; omit for variety. |

Full input schema: see "Schema" tab on Fal.ai model page ([Fal.ai](https://fal.ai/models/fal-ai/ltxv-13b-098-distilled/image-to-video/api "LTX-Video 13B 0.9.8 Distilled | Image to Video | fal.ai")).

* * * * *

### 5\. Few‑Shot Example (Text → Video)

```
{
  "prompt": "Four bioluminescent stingrays glide above a coral city at dusk; camera starts with an overhead crane, then dives beneath translucent wings, revealing electric‑blue veins. Particles shimmer, water caustics dance on ruined statues, cinematic 4 K.",
  "negative_prompt": "worst quality, jitter, duplicate rays, watermark, text overlay",
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "num_frames": 121,
  "frame_rate": 24,
  "enable_detail_pass": true,
  "seed": 20250723
}

```

* * * * *

### 6\. Common Pitfalls & Fixes

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Duplicate objects" | Underspecified counts | Add explicit numbers & unique colours. |
| "Jitter / warping faces" | Too many fine‑detail adjectives | Simplify prompt; enable detail pass. |
| "Video stops early" | Frame count not 8 n + 1 | Use 121, 129, 161... |
| "Dark / over‑saturated" | Long clips drift in colour | Set `temporal_adain_factor: 0.5` (default) or lower. |

* * * * *

### 7\. Advanced Levers

-   **LoRA** -- Drop‑in stylisation weights (`loras: [ { path, scale } ]`).

-   **AdaIN Factor** -- Normalises colour drift on long (> 257 f) outputs.

-   **Tone‑map Compression** -- Pull highlights back on HDR‑ish scenes.

-   **Reverse Video** -- Fun reveal effects---set `reverse_video: true`.

* * * * *

### 8\. Train Your Users

1.  **Give them the JSON snippet** -- Not free‑form prose.

2.  **Bundle negative prompt defaults** -- Saves headaches.

3.  **Surface cost estimate** -- `frames / fps × $0.02` (double if detail pass).

4.  **Expose a "Try 3 Seeds" button** -- Fresh look without typing.

With this playbook your users can consistently hit LTX‑Video's quality ceiling while dodging its quirks. Happy generating!