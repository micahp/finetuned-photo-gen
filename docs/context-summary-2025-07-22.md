# Context Summary – 2025-07-22

- Implemented retry logic for Together AI generate-prompt endpoint to mitigate transient 503 errors (see `decisions/together-ai-retry-handling-2025-07-22.md`).
- Enhanced image prompt generator creativity: new PromptSmith instructions, higher temperature, removed stop tokens (see `decisions/image-prompt-creativity-update-2025-07-22.md`).
- Updated dev docker-compose to forward DATABASE_URL from .env (see `decisions/docker-db-url-env-2025-07-22.md`). 
- Overrode `DATABASE_URL` inside dev compose to `host.docker.internal` and added npm retry logic for registry resilience (see `decisions/docker-dev-url-host-override-2025-07-22.md`). 
- Added comprehensive gap analysis for video advanced settings across all models, including Kling motion-brush capabilities (see `docs/video-advanced-settings-audit-2025-07-22.md`). 
- Compiled and added full Kling AI text guide distilled from screenshots (see `docs/kling_text_guide.md`).
- Added API-level audit of Kling tag names and recommended tooltip labels (see `docs/api-level-kling-tag-&-tooltip-audit.md`).
- **Completed full-stack security audit** and published findings (see `docs/security-audit-2025-07-22.md`).
- Upgraded LTX video models to v0.9.8 (image, text & multiconditioning), renamed IDs, unified cost at 5 credits/s, and lowered Stable Video Diffusion i2v rate to 2 credits/s (see `decisions/ltx-video-model-upgrade-2025-07-22.md`).
- Added guide to preventing gender flips in Flux LoRA training (see `docs/flux-lora-gender-mitigation.md`). 

## Open Tasks (derived from Decision follow-ups)

- [ ] Update advanced video settings (see `docs/video-advanced-settings-audit-2025-07-22.md`). 
- [ ] Implement dynamic backend estimation using historical job durations (`decisions/video-generation-time-metadata-2025-07-22.md`).
- [ ] Remove verbose watermark debug logs once visibility confirmed (`decisions/watermark-visibility-fix-2025-07-22.md`).
- [ ] Add integration tests for zero-credit daily generation flow (`decisions/free-generation-zero-credit-2025-07-22.md`).
- [ ] Display remaining free generations count in the UI (`decisions/free-generation-zero-credit-2025-07-22.md`).