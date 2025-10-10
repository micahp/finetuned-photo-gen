## Context Summary — 2025-08-27

### Overview
- Image editing backend switched to Replicate `google/nano-banana` to accept inline (data URL) inputs and unblock flow.
- Added Fal.ai Gemini 2.5 Flash Image tooling (spec fetch + service stub) for future integration.
- Implemented user-safe error responses for provider billing (402) and no-output cases, with detailed server-side logging.

### Key Changes
- `src/app/api/edit/route.ts`
  - Uses `ReplicateService.editImageWithNanoBanana`.
  - Deducts credits only on success; uploads the returned image to Cloudflare Images for stable hosting.
  - Returns user-safe errors:
    - 503 + `PROVIDER_BILLING` if upstream billing/credit issue.
    - 502 + `NO_OUTPUT` if the provider returns no image output.
  - Logs original provider error details (provider, model, error).
- `src/lib/replicate-service.ts`
  - Added `editImageWithNanoBanana(image, prompt, numImages?)` (accepts data URL or HTTP URL).
- Fal tooling (not yet wired into edit route):
  - `scripts/fal_api_endpoints_25.json` updated with `fal-ai/gemini-25-flash-image/edit`.
  - `scripts/fetch_fal_api_specs.py` runs against endpoints_25 and saved spec to
    `scripts/fal_api_specs/fal-ai_gemini-25-flash-image_edit.json`.
  - `src/lib/fal-image-service.ts` created for calling Fal endpoint when we adopt it.

### Current Status
- Replicate path functional, but currently blocked by upstream 402 (insufficient provider credit).
- No-output case handled gracefully; users aren’t charged and see a friendly message.

### Risks / Considerations
- Provider dependence (Replicate credit availability) can cause intermittent outages.
- Multiple provider paths increase complexity; ensure clear fallback strategy.

### Follow-ups
- Implement circuit breaker for `google/nano-banana` (temporarily hide after repeated failures).
- Add provider credit health check and Slack/Sentry alerting.
- Optionally wire Fal Gemini endpoint as a fallback once upload/input requirements are finalized.

### Related Files
- `src/app/api/edit/route.ts`
- `src/lib/replicate-service.ts`
- `src/lib/fal-image-service.ts`
- `scripts/fetch_fal_api_specs.py`
- `scripts/fal_api_endpoints_25.json`
- `scripts/fal_api_specs/fal-ai_gemini-25-flash-image_edit.json`
- `decisions/image-edit-model-switch-2025-08-27.md`

### References
- Replicate: `https://replicate.com/google/nano-banana`
- Fal Gemini model: `https://fal.ai/models/fal-ai/gemini-25-flash-image/edit`
