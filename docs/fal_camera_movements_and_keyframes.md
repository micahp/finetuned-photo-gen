---
# Camera Movement & Key-Frame Controls on Fal.ai Video Models

This reference explains **what kinds of camera motion you can direct** and **how to specify start / end frames (key-frames)** when generating videos with Fal.ai's hosted models.

> Last updated: 2025-06-28

---
## Quick-Reference Map of Camera-Movement "Knobs"

Below is a concise map (verbatim from user notes) summarising how each major Fal.ai video model accepts camera-motion directives.

```
1.  Kling 2.1 / 2.0 / 1.6 endpoints  (image-to-video, text-to-video, "elements", "master", "standard")

    A.  High-level presets – CameraControlEnum
        •  down_back          (dolly-out + slight tilt-down)
        •  forward_up         (dolly-in  + slight tilt-up)
        •  right_turn_forward (orbit right while moving forward)
        •  left_turn_forward  (orbit left  while moving forward)

    B.  Fine-grained control – advanced_camera_control → CameraControl
        movement_type ∈ {
          horizontal, // truck / track left-right
          vertical,   // pedestal up-down
          pan,        // swivel left-right from a fixed point
          tilt,       // swivel up-down  from a fixed point
          roll,       // rotate around viewing axis
          zoom        // optical / digital zoom in-out
        }
        movement_value → signed int (magnitude & direction)

    •  Combine multiple controls by chaining requests or sequencing shots.
    •  If you only need "simple" moves, use the preset enum; for precise motion paths (e.g. 20-degree pan right) use advanced_camera_control.

2.  MiniMax Hailuo-01 "Director" model (image-to-video & text-to-video)

    •  Understands natural-language keywords for classic moves:
      "zoom in / out", "truck left / right", "tilt up / down",
      "dolly in / out", "rotate", "orbit", "hand-held", etc.
    •  Limit to ~3 distinct moves per shot for best adherence.

3.  Veo 2 / Veo 3 text-to-video

    •  No formal API fields – you steer the camera via prose:
      "cinematic tracking shot", "slow dolly-in", "FPV drone orbit",
      "hand-held shaky cam", "static locked-off frame", …
    •  Works well when you embed the move after the SUBJECT / ACTION clause in the prompt.

4.  Wan-2.1, Seedance 1.0, Wan-VACE, Phantom, etc.

    •  Follow the same pattern as Veo: describe the move in text.
    •  The models replicate most standard moves (dolly, pan, tilt,
      track, zoom) but ignore exotic ones (dolly-zoom, parallax wipe).

Practical recommendations
-------------------------
1.  **Programmatic control?**  Use Kling 2.1's advanced_camera_control
    when you need deterministic, repeatable motion (e.g. generating
    multiple variants with identical camera paths).

2.  **Prompt-only control?**  For Veo / Wan / Hailuo, keep the camera
    directive short and concrete:

    A close-up of a ceramic cup on a table — slow dolly-in, shallow DOF
    Drone-like orbit around a lighthouse at sunset, clockwise, 360°

3.  **Chaining moves**  Models follow ~2-3 movements reliably in one
    clip.  For more complex sequences, stitch multiple 5- or 10-second
    clips together.

4.  **Magnitude tuning**  If a movement feels too weak/strong in Kling,
    adjust `movement_value` (typical useful range 10-40).
    Positive ↔ forward/up/right, negative ↔ opposite direction.

5.  **Fallback**  When a model ignores a move, prepend it with "The
    camera…" or upgrade to Kling 2.1 Master, which has the highest
    motion-fidelity on Fal today.

With these options you can cover the full slate of classic cinematography moves – pan, tilt, roll, truck/track, pedestal, dolly, zoom, orbit – across Fal's model lineup and pick the interface (hard API fields vs. prompt text) that matches your workflow.

---
## 1. Camera Motion

### 1.1 Kling 2.1 / 2.0 / 1.6

These endpoints expose both *preset* and *fine-grained* motion controls.

| Option | Purpose | Values / Notes |
|--------|---------|----------------|
| **`camera_control`** | Quick presets that combine common dolly/orbit paths. | `down_back`, `forward_up`, `right_turn_forward`, `left_turn_forward` |
| **`advanced_camera_control`** | Low-level parameter object for one motion axis. | ```json
{
  "movement_type": "horizontal",   // horizontal | vertical | pan | tilt | roll | zoom
  "movement_value": 20              // signed int; magnitude & direction
}
``` |

* Chain multiple moves by splitting the video into sequential 5 s / 10 s clips.
* Typical useful *movement_value* range = **10 → 40**; positive is fwd/up/right, negative reverse.

### 1.2 MiniMax Hailuo 01 "Director"
Natural-language prompt keywords – obeys up to **3 distinct moves** per shot.

```
… a dreamy landscape, **slow dolly-in, slight tilt-up, hand-held shakiness**
```

### 1.3 Veo 2 / Veo 3, Wan-2.1, Seedance, Phantom, …
No structured fields; embed the move in prose:

```
Drone-like orbit around a lighthouse at sunset, clockwise, 360°
```

---
## 2. Start / End (Key-frame) Support

| Model | Field(s) | Behaviour |
|-------|----------|-----------|
| **Kling 2.1 / 2.0 *Pro*** | `image_url` *(start frame)*  +  `tail_image_url` *(end frame)* | First frame ≈ `image_url`, last frame ≈ `tail_image_url`; interpolated motion in between. |
| **Kling 1.6 "Elements"** | `input_image_urls` (1-4 images) | Appears in order → multiple key-frame sequence. |
| **Other Fal models** | n/a | No native key-frame API – stitch several short clips externally. |

### Example – Kling 2.1 Pro
```ts
import { fal } from "@fal-ai/client";

await fal.subscribe("fal-ai/kling-video/v2.1/pro/image-to-video", {
  input: {
    prompt: "A knight walks through a neon-lit corridor, cinematic",
    image_url: "https://example.com/start.jpg",     // start
    tail_image_url: "https://example.com/end.jpg",  // end
    duration: "10",
    camera_control: "forward_up"                     // optional
  }
});
```

---
## 3. Practical Tips

* **Keep it simple.** Models follow ≤ 3 moves reliably in one clip.
* **Match lighting & style** between `image_url` & `tail_image_url` to avoid harsh morphing.
* **Speed tweaks** – For prompt-based models add "slow-motion", "time-lapse", etc.
* **Post-production** – For complex stories render multiple 5-second clips and assemble in an editor.

---
### Cheat-Sheet: Common Move Keywords

| Move | Keywords |
|------|----------|
| Dolly-in / Dolly-out | *dolly in*, *dolly out*, *moves forward/backward* |
| Truck / Track | *truck left/right*, *track left/right*, *camera moves left/right* |
| Pedestal | *move up*, *move down* |
| Pan / Tilt | *pan left/right*, *tilt up/down* |
| Roll | *rotate clockwise/counter-clockwise* |
| Orbit / Arc | *360° shot*, *orbit*, *arc shot* |
| Zoom | *zoom in/out*, *whip-zoom* |
| Static | *locked-off*, *static shot* |

---
**That's it—now you can script precise camera paths and key-frame transitions with the Fal.ai stack. Happy directing!** 