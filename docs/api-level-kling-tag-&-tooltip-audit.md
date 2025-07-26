```markdown
# Fal.ai Video Model Feature Matrix (API‑Confirmed)

> **All details below come directly from each model’s `/api` schema on Fal.ai (July 2025).**

---

## Audio

| Model          | Capability                                             | Parameter |
|---------------|---------------------------------------------------------|-----------|
| **Veo 3** (incl. *Veo 3 Fast*) | Generates video *with* synchronized audio. | `generate_audio: true / false` |
| **All other listed models** | Silent video (no audio parameter exposed). | — |

---

## Camera

### Basic Camera Moves (Kling 1.6 / 2.0 / 2.1)  
Provide one of the following values via **`camera_control`**:

```

down\_back │ forward\_up │ right\_turn\_forward │ left\_turn\_forward

```

### Fine‑grained Camera Path (Kling 2.x only)  
Pass an **`advanced_camera_control`** object:

| Field | Allowed values |
|-------|----------------|
| `movement_type` | `horizontal`, `vertical`, `pan`, `tilt`, `roll`, `zoom` |
| `movement_value` | Integer or float (degrees / percent depending on move) |

### Prompt‑driven Camera Moves  
Supported by **Hailuo‑01 Director, Veo 2 / 3, Wan‑2.1**.  
Embed natural‑language instructions in the prompt (square‑bracket style):

```

\[A truck left, slow zoom in, orbit clockwise]

````

---

## Keyframes

| Model | Method | Parameters |
|-------|--------|------------|
| **Kling 2.1 / 2.0** | Start & end frames | `image_url` (start) **+** `tail_image_url` (end) |
| **Kling 1.6 Elements** | Multi‑keyframe sequence (≤ 4) | `input_image_urls[]` |
| **Others** | No native key‑frame support; stitch clips externally | — |

---

## Supported Fal.ai Endpoints

* Kling 2.1 Pro / 2.0 Master / 2.0 Pro / 1.6 Elements  
* MiniMax **Hailuo‑01 “Director”**  
* **Veo 3** / **Veo 2**  
* **Wan‑2.1**  
* **Seedance 1.0** \*  
* **Phantom** \*

> \* Seedance 1.0 and Phantom ignore **all** camera‑ and key‑frame‑related parameters. They still render the clip, but those fields are silently dropped.

---

## Recommended UI Tag Names

| Old Label               | Use Instead                   |
|-------------------------|-------------------------------|
| Camera Presets          | **Basic Camera Moves**        |
| Advanced Camera Control | **Fine‑grained Camera Path**  |
| Start & End Frames      | **Keyframe Start / End**      |

*(If you prefer single‑word chips: `Presets` • `Path` • `Keyframes`)*

---

### Quick Reference Examples

```jsonc
// Basic move (Kling)
{
  "camera_control": "forward_up"
}

// Fine‑grained path (Kling 2.x)
{
  "advanced_camera_control": { "movement_type": "pan", "movement_value": 30 }
}

// Keyframe start & end (Kling 2.1)
{
  "image_url": "face_closeup.png",
  "tail_image_url": "wide_scene.png"
}

// Prompt‑driven camera (Hailuo Director)
{
  "prompt": "A cyberpunk alley at night. [Tilt up, slow zoom in]"
}
````

Save this file as **`fal_video_model_matrix.md`** and drop it in your repo or docs site as needed. ✨

```
::contentReference[oaicite:0]{index=0}
```
