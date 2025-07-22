### [Decision 1]: Free Zero-Credit Daily Generations
**Timestamp (UTC):** 2025-07-22T00:00:00Z
**Scope:**
- `src/app/api/free-generation/remaining/route.ts`
- `src/app/dashboard/generate/page.tsx`
- `scripts/create-test-user-zero-credits.js`

**Change Summary:**
Implemented backend endpoint to expose remaining daily free image generations and updated front-end logic to enable generation when credits are 0 but free allowance exists. Added helper script to spin up a zero-credit test user.

**Rationale:**
Users on the free plan should be able to utilise their daily 5 free generations without pre-loading credits. The previous UI disabled the button purely on credit count. Aligning the UI with backend logic removes friction and surfaces the product’s free value proposition.

**Alternatives Considered:**
- *Increase default credit balance to ≥5* — rejected: obscures credit economy and conflicts with pricing strategy.
- *Rely on backend error message and re-enable on failure* — rejected: poor UX; user still sees disabled button.

**Trade-offs / Risks:**
- Extra API call adds negligible latency on dashboard load.
- Requires keeping backend free-allowance logic in sync with front-end assumptions.

**Follow-ups / TODOs:**
- Add integration tests for zero-credit flow.
- Surface remaining free generations in the UI (e.g. “3/5 free gens left”).
- Document API route in developer docs.

**Source Prompt(s):**
- “why on the live app on my server can't i use the free generation especially if I have a credit…"
- “we are not giving users more credits. it shouljd work if they don't have credits…” 