# Homepage & Explore Revamp – Photo-First Focus

*Derived from `docs/higgsfield_explore_insights.md` + `docs/krea_ui_overview.md`*

> **Note:** Initial launch will emphasise **photo generation** while keeping clear upgrade paths to video / camera-move features.

────────────────────────────────────────
## 1 Public Home Page (`/`)

### Goal  
Grab first-time visitors with a "run a film studio (starting with stunning photos) here" hook and funnel them straight into generation.

### Section blueprint
1. **Hero montage** (auto-playing, 12 s loop)  
   – 3-panel storyboard → live camera-move shot (Krea start/end demo) → finished vertical photo/video.  
   – CTA buttons: *"Generate a look"* | *"See storyboarding workflow"*
2. **"Direct Like a Pro" feature row**  
   Column grid (Higgsfield "Camera Controls" style) with six preset cards:  
   • Slow Dolly-In • 360 Orbit • Crane-Down • Fisheye FPV • Crash Zoom • Hand-held Shake  
   Hover → GIF preview, click → `/generate?motion=crash_zoom`.
3. **"Storyboard → Scene in 3 Steps"**  
   Borrow Krea wizard layout (01 pick images → 02 arrange in Flux Kontext → 03 generate shots).  
   Running credit meter ("≈ 24 credits").
4. **Community reel carousel**  
   4:5 thumbnails (muted autoplay); click forks settings. Tag pills echo Higgsfield rows.
5. **Footer CTA** → *Explore page*.

────────────────────────────────────────
## 2 Explore Page (`/explore`)

### Goal  
Living catalogue & self-serve tutorial hub (photo presets first, video later).

| Section | Content | Interactive |
|---------|---------|-------------|
| **Starter Styles** | Higgsfield-style image presets (Soul tags) | Tag pill filter |
| **Storyboard Templates** | Pre-made Flux Kontext boards | "Use this board" |
| **Camera Moves** | Adapt 6-card Pro set, with "Load preset + key-frame" | Links to generator |
| **Key-Frame Examples** | Krea start/end screenshots | Hover shows in/out stills |
| **Visual FX** | Explosions, datamosh (Higgsfield pattern) | "Apply effect" |
| **Speaking Avatars** | Krea/Kling avatar grid | "Re-voice" |

**Sticky side panel**  
Shortcuts cheat-sheet (`⌘K`, `/slash`, frame keys) + live credit balance.

────────────────────────────────────────
## 3 Dashboard Nudge Row (top of `/dashboard`)

Dynamic cards (160 × 160 hover tiles):
* No `camera_motion` → "Add your first camera move".
* No key-frame usage → "Try start/end frames".
* ≤ 1 board → "Storyboard faster with templates".

────────────────────────────────────────
## 4 Generator Page Tweaks (`/generate`)

1. Inline **credit meter** beside Generate button.  
2. Right-rail 3-step wizard; highlight Start/End when motion selected.  
3. Tooltip: `⌥ drag` to scrub, `⇧S` save preset.

────────────────────────────────────────
## Asset & Doc Hooks

* Screenshots live in `assets/` (e.g. `assets/krea_wizard_01.png`).
* "Learn more" links point to the two source docs for deep dives.

────────────────────────────────────────
## Next Implementation Moves

1. Storybook components: `HeroMontage`, `PresetCard`, `WizardSnapshot`.
2. Querystring-driven preset loading in `/generate`.
3. PostHog events: `homepage_preset_click`, `explore_filter_select`.
4. Populate `assets/` once captures ready.

— **End of plan** — 