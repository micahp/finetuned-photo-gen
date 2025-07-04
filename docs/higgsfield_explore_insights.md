# Higgsfield Explore / Home-Page UX Insights  
*(Source: https://higgsfield.ai, captured 2025-06-28)*

---
## 1. Page-Level Concept  
Higgsfield collapses **marketing homepage** and **feature discovery hub** into a **single, scroll-first Explore page**.

* One canonical URL (`/`) that immediately showcases what the product *does*, instead of who they *are*.
* Hero region is a carousel of polished in-app examples – zero abstract slogans.
* Subsequent sections act like **mini-libraries**: pre-filtered grids you can *click-into and regenerate*.

> 💡 Take-away → Treat our landing as an **interactive sampler**: every block should produce a "try it now" pathway, not just a demo video.

---
## 2. High-Level Section Anatomy
| Order | Section Name | Purpose | Key UI Patterns |
|-------|--------------|---------|-----------------|
|1|**Higgsfield Soul** (Image model)|Show SOTA photorealism presets|• Large hero thumbnails  <br>• Tag-pill filter row (0.5 Selfie, Vintage, etc.)  <br>• Hover → subtle zoom & play  |
|2|**Visual Effects**|Promote video post-fx templates (explosions, datamosh)|• Section title + one-line descriptor  <br>• Dense card grid 4×N  <br>• "View all" button anchors to /create/video with model pre-selected|
|3|**Camera Controls**|Teach cinematic moves (crash-zoom, orbit)|• Descriptive sub-header ("AI-crafted cinematic moves…")  <br>• Cards are labelled GIF loops  <br>• CTA copies the motion into generator|
|4|**Catch the Pulse**|High-energy sports motions|Same grid pattern; each click opens generator with preset tags|
|5|**I Can Speak**|Avatar lip-sync model|Category tabs (Beauty, Vlog…) <br>Inside → vertical grid of 9:16 videos|

---
## 3. Drill-Down Flow (Create → Video)
1. **Mode switcher**: Image / Video / Speak dropdown at top-left.
2. **Three-panel wizard** displayed inline centre:
   1️⃣ Choose motion (pre-sets list)  
   2️⃣ Add image (upload / generate)  
   3️⃣ Get video (Generate button with credit cost badge)
3. Left sidebar maintains prompt & model selector; credit cost updates live.

> 💡 Take-away → Inline wizard lowers cognitive load; cost badge keeps transparency.

---
## 4. Speak Flow (Talking Avatars)
* Explore > I Can Speak opens a grid of avatar categories.  
* Selecting a category navigates deeper (`/avatars/{id}`) showing example clips (11–13 s).  
* Click any clip → modal preview + **Recreate** CTA that forks params.

**Same pattern in Higgsfield Soul (Image) flow**  
An image grid tile opens the exact same modal on click (see `Eating Food` screenshot) with a right-hand prompt description and a **Recreate** button that reforks parameters into the image generator. This consistency reinforces the "see example → remix instantly" habit across media types.

---
## 5. Micro-Copy & Visual Language
* **Section headings** = neon-green mono-caps on black → bold & readable.
* Action verbs: *Generate ★ 5* communicates credit cost inline.
* Tags are **caps-lock, monospace pills**; encourage exploration.

---
## 6. Patterns Worth Replicating
1. **Hybrid Landing/Explore** – eliminates extra click; users instantly browse capabilities.
2. **Tag-pill Filters** – quick thematic browsing; can translate to our model / style filters.
3. **Inline Credit Cost Badges** – set expectation before generation.
4. **3-Step Wizard** – standardise advanced feature onboarding (camera moves, key-frames).
5. **"View all" CTA** – deep-links with pre-selected model & motion preset; shortens journey.

---
## 7. Potential Enhancements for *Our* Home
* Embed **Storyboard → Scene** flow as an additional section between Visual Effects and Camera Controls.
* Replace static "View all" with **hover → live preview** (Krea-style) to emphasise speed.
* Add **credit estimator slider** on hover so users learn cost scaling.
* Surface **camera key-frame cheatsheet** with a small "i" icon inside Camera Controls row.

---
## 8. Implementation Notes
* Use **Next.js dynamic `VideoCard`** component to reuse grid pattern across sections.
* Leverage existing `use-usage-limits` hook to fetch live credit costs for display badges.
* Pre-populate generator route via querystring: `/generate?motion=dolly_in&image-preset=general`.
* Track click-through with `posthog.capture('homepage_sample_click', {section, preset})`.

---
**End of document** 