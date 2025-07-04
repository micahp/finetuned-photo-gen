---
# Krea.ai — UI Quick-Start Guide

> Screenshots captured June 2025 • Applies to the public beta UI at <https://krea.ai>

---
## 1. Home Dashboard

![Krea Home](../assets/krea_home.png) <!-- if you store screenshots, adjust path -->

| Region | What you'll find |
|--------|------------------|
| **Hero Carousel** | Large slide cards announcing major releases. Left card often links to *Image* generator, right card to blog posts / model launches. |
| **Generate Strip** | Quick-launch icons for every tool: *Image*, *Video*, *Realtime*, *Enhancer*, *Edit*, *Video Lipsync*, *Train*, *3D Objects*, *Video Restyle*, *Stage*, etc.  Each icon shows a badge when a feature is *New*. |
| **Gallery** | Scrollable feed of public creations; "Open Gallery" button opens full explorer. |
| **Status Bar (top-right)** | Daily credit meter, *Upgrade Now* button. |

Navigation is minimal—almost all workflows start by clicking one of the *Generate* icons.

---
## 2. Image Generator

![Image UI](../assets/krea_image_generate.png)

1. **Prompt Canvas** – Full-width hero image with overlay prompt box.  The placeholder prompt rotates through example descriptions.
2. **Generate Button** – Runs generation; while working, the button turns into a progress indicator.
3. **Examples Strip** – Thumbnails under the canvas; click to autofill prompt.
4. **Toolbar (top-center)**
   * 🏠 Home   🖼 Image   🖌 Edit   ✎ Paint   ⋯ miscellaneous.
5. **Global Controls (top-right)** – Theme switcher, credits, upgrade.

### Workflow
1. Type a prompt or click an example.
2. *Generate* → model selects default (Flux or Ideogram) unless changed via the *Style* popup in the prompt box.
3. Editing options (Kontext) appear after generation.

---
## 3. Video Generator

![Video UI](../assets/krea_video_generate.png)

| Control | Purpose |
|---------|---------|
| **Prompt Box** | "Describe a video and click Generate…" placeholder. |
| **Start frame** button | Upload or paste an image – becomes the *first* frame (Kling-style). |
| **End frame** button | Optional *last* frame for two-way interpolation. |
| **Style** | Dropdown of cinematic looks / LUTs. |
| **Resolution** | 720p by default; 1080p/4K behind Pro tier. |
| **Generate** | Starts the request; shows live status. |
| **Model Picker (bottom-left)** | Dropdown currently listing *Wan 2.1*, *Seedance 1.0*, *Hailuo 02*, etc. Use to switch back-end. |

### Tips
* For motion guidance include camera verbs in prompt (e.g. "slow dolly-in").
* If using *Start* + *End* frames keep lighting consistent to reduce morph artefacts.
* Daily free tier credits reset at midnight UTC – watch the meter top-right.

---
## 4. Shared UI Elements

* **Mini-Dock (top-center):** icons switch instantly between Home 🏠, Image 🖼, Video ⬛, Paint 🖌, etc.
* **Keyboard Shortcuts:**  
  `G` → Generate  `Esc` → Clear prompt  `V` → Video tab  `I` → Image tab.
* **Credits & Subscription:** visible in every view; click *Upgrade Now* for paid plans.

---
### Changelog
* **2025-06-28:** initial draft, based on UI in screenshots provided by user.

---
© 2025 Your Team – feel free to modify or redistribute. 