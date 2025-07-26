# Kling AI – Text-to-Video Guide

## 1. Essential Functions

By entering a text passage, Kling’s large-model engine produces a **5- or 10-second** video translating words into visuals.

• Two generation modes  
  – **Standard Mode** (faster)  
  – **Professional Mode** (higher quality)

• Aspect-ratio choices: **16:9 | 9:16 | 1:1**

---

### Prompt Formula (recommended)

```text
Prompt = Subject (Subject Description) +
         Subject Movement +
         Scene (Scene Description) +
         (Camera Language + Camera Movement +
          Lighting + Atmosphere)          // optional refinements
```

Key elements:

- **Subject** – main focus (people, animals, objects)
- **Subject Description** – appearance or posture phrases
- **Subject Movement** – still/motion suited to 5 s clip
- **Scene** – environment around subject
- **Scene Description** – concise setting details
- **Camera Language** – shot types & transitions (wide-angle, close-up, aerial…)
- **Lighting** – ambient, sunrise, sunset, shadow-play, etc.
- **Atmosphere** – overall mood & tone

> Minimum viable prompt: **Subject + Movement + Setting**.  
> Add camera, lighting, or atmosphere clauses for finer control.

---

## 2. Enriching Your Prompt (example workflow)

The formula above is a scaffold—feel free to expand on it with vivid, cinematic detail.

**Base idea**  
“A giant panda is reading a book in a café.”

**Step 1 – add subject & scene specifics**  
“A giant panda, *wearing black-rimmed glasses*, is reading a book in a café, the book resting on a table beside a *steaming* cup of coffee by the café’s window.”

**Step 2 – layer cinematic language & lighting**  
“*Medium shot with blurred background and atmospheric lighting.*  
A giant panda, wearing black-rimmed glasses, reads a book in a café. The book lies on a table, steam rising from a hot coffee cup, next to the window; movie-level color palette.”

Result: a richer prompt that Kling can interpret into a more textured video.

---

*(Guide built through screenshot #2. Say “next” to add the third screenshot’s material.)* 

## 3. Prompt Examples & Inspiration

Below are sample prompts and results shared by Kling creators (screenshots #3-4).  Use them to spark ideas or benchmark quality.

| Prompt | Mode | Ratio | Notes |
| --- | --- | --- | --- |
| *A giant panda is eating hot-pot with chopsticks, street background* | Standard | 16:9 | Good for action + environment |
| *A Pikachu is sitting on a chair, drinking coffee and reading a newspaper* | Standard | 16:9 | Shows stylised IP usage |
| *A polar bear is playing the violin in the snow* | Standard | 16:9 | Combines animal + instrument |
| *A bee with a puppy’s head* | Standard | 16:9 | Example of surreal hybrid subject |
| *Morning mist, sunrise lens-flare, cool breeze; close-up of a Chinese woman, hair blowing* | Standard | 16:9 | Atmospheric portrait |
| *A Chinese little girl holding a pink balloon, smiling in a playground* | Standard | 16:9 | Child + prop + setting |

*Takeaway:*  Even in Standard Mode you can achieve vibrant, cinematic clips when the prompt is specific about **subject • action • setting**.

---

## 4. Image-to-Video Formula (screenshots #5-6)

```
Prompt = Subject + Movement,  Background + Movement   // if needed
```

Differences from text-to-video:
1. **Scene already exists** in the image – no need to re-describe it unless you want changes.
2. Focus on describing **how the subjects should move**.
3. For multiple subjects, list movements sequentially.

Example ― *“Mona Lisa puts on sunglasses with her hand, and a ray of light appears in the background.”*

---

## 5. Elements Feature (screenshots #7-9)

*Upload 1-4 images → pick subjects as “elements”.*

Use-cases:
1. **Character consistency** – keep a subject’s look across shots.
2. **Cross-shot interaction** – have multiple uploaded subjects interact.

Steps
1. Upload refs & mark each element.
2. Craft prompt describing scene & actions.
3. Generate video – Kling blends reference fidelity with new motion.

Tip:  Works great for fashion, mascots, product shots, or keeping an avatar on-brand.

---

## 6. Camera Movement (screenshots #10-11)

Kling lets you pick from 6 basics plus 4 “master shots”.

Basics: **horizontal, vertical, zoom, pan, tilt, roll**  
Master shots: *move-left-&-zoom-in*, *move-right-&-zoom-in*, *move-forward-&-zoom-up*, *move-down-&-zoom-out*.

Add the camera movement name to the prompt or select in UI, e.g.:
> *A giant panda plays piano by the lake — pan left and zoom in.*

---

## 7. Start & End Frames (screenshots #12-14)

Upload a **start image** and **end image**.  Kling creates a smooth 5-10 s transition.

Guidelines
- Choose visually similar images for best continuity.
- Large differences may force a hard cut.
- Great for turning static generative images into animated reveals.

---

## 8. Motion Brush (screenshots #15-19)

Adds precise motion control **on top of Image-to-Video**.

Workflow
1. Upload image.
2. **Brush** an element (auto or manual) → draw trajectory curve.
3. Add matching text prompt (*element + motion*).
4. (Optional) add **Static Brush** to pin background.

Tips
- One motion brush ≈ one subject.
- Trajectory direction & length matter; element follows path exactly.
- Unrealistic paths may be interpreted as camera moves.
- Combine **Static Brush** with **Motion Brush** to avoid unwanted camera drift.

---

## 9. Extend with Prompts (video continuation) (screenshot #20)

After generating a clip you can extend it in 4-5 s increments up to ~3 min.

Modes
- **Auto-Extend** – Kling continues the story.
- **Custom Extend** – supply a new prompt.  Keep the same *subject + movement* for continuity.

Prompt mini-formula: `Subject + Movement`.

---

## 10. Standard vs Professional Mode (screenshots #21-22)

| Mode | Strengths |
| --- | --- |
| **Standard** | Faster, cheaper, softer colour palette, great for animals & quick iterations |
| **Professional** | Richer detail, sophisticated composition/lighting, best for high-end work |

Pick based on budget & desired fidelity.

---

## 11. Lip Sync (screenshots #23-24)

Add voice-overs to character videos.
1. Generate/choose a video with a clear face.
2. Click **Lip Sync → Text-to-Speech** *or* upload WAV/MP3.
3. Hit **Lip Sync** and wait – audio is matched to mouth movements.

Pricing is usage-based (credits scale with video length).

---

## 12. Quick Prompt / Brush Tips (misc screenshots)

- Use **simple sentences**; keep visual complexity manageable for ≤ 10 s.
- Numbers & counts (e.g. “10 puppies”) are hard to keep accurate.
- For split-screen concepts: *“4 camera angles representing spring, summer, autumn, winter.”*
- High-physics actions (balls bouncing, complex throws) remain challenging.
- When Motion-Brushing, selecting **only the key part** (e.g., an animal’s head) produces cleaner control.
- For Motion Brush, **one connected region = one brush**; static brush can cover multiple areas.

---

*(This completes content from all provided screenshots – guide finished).* 