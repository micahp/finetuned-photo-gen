### [Decision 1]: Adopt unified `useJobProgress` hook for model jobs
**Timestamp (UTC):** 2025-07-24T17:30:00Z
**Scope:** src/hooks/use-job-progress.ts, src/app/dashboard/video/page.tsx, docs/context-summary-2025-07-24.md
**Change Summary:** Added a provider-agnostic React hook (`useJobProgress`) that prefers SSE for Fal & Replicate and falls back to polling; refactored video generation page to use it; updated context summary.
**Rationale:** Multiple ad-hoc mechanisms (Fal SSE proxy, JSON polling) caused duplicate code and confusion. A single hook simplifies the UI, reduces bugs, and clarifies future integrations.
**Alternatives Considered:**
  - Keep separate subscribe/poll logic — rejected for maintenance overhead.
  - Poll only — lower UX quality, higher latency.
**Trade-offs / Risks:**
  - Slight additional bundle size for the hook.
  - Needs validation on browsers that block EventSource; hook handles fallback.
**Follow-ups / TODOs:**
  - Remove obsolete `pollVideoStatus` helper after further testing.
  - Apply hook to image generation and other providers.
**Source Prompt(s):** “ok let's do it” – unify progress mechanism. 