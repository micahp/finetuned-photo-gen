### [Decision 3]: Add user-safe error handling for provider billing and no-output
**Timestamp (UTC):** 2025-08-27T00:00:00Z
**Scope:** `src/app/api/edit/route.ts`
**Change Summary:** Mapped upstream 402 “Payment Required” to 503 with code `PROVIDER_BILLING`, and
empty/no-output responses to 502 with code `NO_OUTPUT`. Messages tell users the model is
temporarily unavailable or that no image was generated, and confirm no credits were charged.
**Rationale:** Avoid leaking provider internals and provide clear, actionable feedback with safe
fallbacks while preserving good UX.
**Alternatives Considered:**
- Surface provider error text — rejected due to poor UX/security.
- Retry automatically — rejected to avoid waste and latency; better to offer fallbacks.
**Trade-offs / Risks:**
- Users may see generic errors; logs must be sufficient for debugging.
**Follow-ups / TODOs:**
- Implement a circuit breaker to temporarily hide failing models after repeated errors.
- Add health checks/alerts for provider credit status.
**Source Prompt(s):**
- “Informative, user-safe message… Offer fallback models immediately.”
- “still log the original error for debugging purposes of course”

---

### [Decision 2]: Switch image editing backend to Replicate `google/nano-banana`
**Timestamp (UTC):** 2025-08-27T00:00:00Z
**Scope:** `src/app/api/edit/route.ts`, `src/lib/replicate-service.ts`
**Change Summary:** Replaced Fal flow with Replicate `google/nano-banana` for image editing. Accepts
client data URLs directly; uploads returned image to Cloudflare Images for stable hosting. Updates
credit metadata to `provider: replicate` and `model: google/nano-banana`.
**Rationale:** Fal flow required public URLs and additional upload plumbing; Replicate model supports
inline file input and is faster to integrate to unblock editing.
**Alternatives Considered:**
- Continue with Fal Gemini endpoint — required building robust upload-to-public flow first.
- Implement dual-path fallback immediately — deferred to keep change small.
**Trade-offs / Risks:**
- Dependent on Replicate account credit; added friendly handling for 402.
**Follow-ups / TODOs:**
- Add configurable fallback chain (Replicate → Fal → Other) behind a flag.
- Consider preflight “provider credit” health checks.
**Source Prompt(s):**
- “looks like replicate has the model under google/nano-banana. It takes in file input. Let's switch
  to replicate's version to avoid doing too much work right now.”

---

### [Decision 1]: Add Fal Gemini 2.5 Flash Image tooling (spec + service stub)
**Timestamp (UTC):** 2025-08-27T00:00:00Z
**Scope:** `scripts/fetch_fal_api_specs.py`, `scripts/fal_api_endpoints_25.json`,
`scripts/fal_api_specs/fal-ai_gemini-25-flash-image_edit.json`, `src/lib/fal-image-service.ts`
**Change Summary:** Added endpoint to the Fal spec list, fetched and stored its OpenAPI spec, and
introduced `FalImageService` to call `fal-ai/gemini-25-flash-image/edit`. Not wired into the edit
route.
**Rationale:** Prepare for future Fal integration while we unblock with Replicate.
**Alternatives Considered:**
- Skip tooling — rejected; keeping specs up to date helps future development.
**Trade-offs / Risks:**
- Extra code paths to maintain; currently unused in production flow.
**Follow-ups / TODOs:**
- Revisit Fal path once upload pipeline is finalized and model availability is stable.
**Source Prompt(s):**
- “gemini flash image … replacing our image editing model with it”
- “also run the little api spect script we have for this”
