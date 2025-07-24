# Decision – Hide Prompt Field for Stable-Video Diffusion Models (2025-07-24)

## Status
Accepted – implemented on 2025-07-24.

## Context
Fal’s **Stable Video Diffusion** (image-to-video) models ignore any text prompt and currently cap output duration at **3 seconds**. Our generic video generation form, however, showed a prompt textarea by default. Users typed creative prompts, hit *Generate*, and then wondered why the result ignored their words. Some tried workarounds (e.g. switching models mid-flow) and reported “prompt not working” bugs.

## Decision
1. **Conditional UI rendering**
   – When a user selects a model whose `category === "image-to-video"` **and** whose endpoint ID matches `fal-ai/stable-video` (or any alias we register), the `needsPrompt` flag is set to `false`.
   – The prompt textarea **is not mounted** at all when `needsPrompt === false`.
2. **Layout continuity**
   – The space is collapsed; neighbouring controls shift up smoothly.
   – A small helper label, “Prompt not required for Stable-Video models”, is rendered in place to avoid layout jumps and to explain the absence.
3. **Validation & submission**
   – Because the prompt input never mounts, no `prompt` field is sent to the backend; existing schemas remain valid.
   – Duration picker remains capped at 3 s as a separate guard (unchanged).
4. **Documentation update**
   – Added this doc and a one-line note in the in-app tooltip and API docs pointing users to models that *do* accept prompts (e.g. PixVerse) if needed.

## Consequences
• Users are no longer confused by a non-functional prompt field when using Stable-Video models.
• Backend receives cleaner, minimal JSON; no need for extra prompt-stripping logic.
• The pattern establishes a precedent for future model-specific UI capability toggles.

## References
– Fal stable-video OpenAPI spec: `scripts/fal_api_specs/fal-ai_stable-video.json`  
– Internal ticket #VID-2341 – “Prompt ignored on Stable-Video” (resolved) 