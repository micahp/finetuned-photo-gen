# Video Generation – Fast-Feedback & Loop-Break Plan (2025-07-24)

## 1. Where the Loop Happened

| Timestep | Approach Chosen | Result Seen | Reaction | New Confusion |
|----------|-----------------|-------------|----------|---------------|
| **T-1** (07-22) | Use Fal **WebSocket `subscribe()`** directly from browser | Mixed CORS & API-key leaks | Moved API call to backend proxy | Why do we still get 405? |
| **T-2** | Backend switched to **`/status/stream` SSE** via Node API route | 405 & silent buffering (gzip) | Added 2-KB preamble, disabled compression | Progress bar still freezes; why no %? |
| **T-3** | Adopted **regex parser** for `%` logs | Works for integer values | Decimal logs from LTX break parse | Is it Fal or our regex? |
| **T-4** | Added decimal support, but EventSource closes instantly | Discovered **double-encoded modelId** | Fixed encode bug | Edge handler now throwing JSON parse error |
| **T-5** | Trimmed whitespace before `JSON.parse` | Progress starts, then **“controller already closed”** | Added `closed` guard | Still drops to polling sometimes—why? |
| **T-6** | Introduced heartbeat, unified hook | Works for streaming models | Non-streaming models stall at 0 % | Are we polling fallback too late? |

**Pattern:** every pivot solved the immediate symptom but introduced a *different* edge-case, causing context-switch overhead and re-debug.

## 2. Recurring Friction Patterns

1. **Invisible Transport Layer Bugs** – gzip buffering, Edge 30 s timeout, double-encoding.
2. **Provider Heterogeneity** – some Fal models stream `%`, some only `metrics.percent_complete`, some none.
3. **Ad-hoc Testing** – fixes validated manually; no codified regression harness.
4. **Hot-reload Interference** – dev loops produce false negatives (stream killed by HMR).

## 3. Fast-Forward Safety Net (Test-Driven)

### 3.1 Contract Tests (Jest + Node)

#### `tests/contract/fal-sse-contract.test.ts`
```ts
// Pseudo-code
it('streams at least one progress event', async () => {
  const res = await fetch(`/api/fal/stream?modelId=${fixture.model}&requestId=${fixture.id}`)
  const messages = collectFirstN(res.body, 5, 5000) // helper with 5-s timeout
  expect(messages.some(m => JSON.parse(m).type === 'progress')).toBe(true)
})
```
*Runs in CI with **mock upstream** implemented via `msw`.*

### 3.2 Parser Snapshot
```
expect(parseFalProgress('Decoding 43.6 %')).toBe(44)
expect(parseFalProgress('45 / 100')).toBe(45)
```

### 3.3 Playwright E2E
* Spin up dev server, kickoff video generation (seeded fixture) → assert progress bar ≥10 % within 7 s.

### 3.4 CLI Smoke Script
`scripts/smoke-fal-sse.sh` – accepts `modelId requestId`, curls proxy, exits non-zero if no `progress` received.

### 3.5 Watchdog Log Rule
CI greps dev-server console for `Fal SSE error` or `controller already closed`; fails build if count > 0.

## 4. Observability Hooks

* **`DEBUG_FAL_SSE`** flag already added – stream breadcrumbs to server log.
* Add **Prometheus counters**: `fal_sse_errors_total`, `fal_sse_progress_events_total`.
* Grafana alert: `fal_sse_errors_total / fal_sse_progress_events_total > 0.05` for 5 min.

## 5. Future-Proof Guidelines

1. Every transport refactor must ship with **one contract test** + **one E2E**.
2. Never push code that changes proxy URL or encoding without running `smoke-fal-sse.sh`.
3. When adding a new model, populate `fixtures/non_streaming_models.json` and assert *expected* behaviour (stream vs metrics vs none).
4. Keep a **tech-debt checklist** entry: “Add synthetic `done` if stream ends at pct 100 but no TERMINAL status.”

## 6. Implementation TODOs

- [ ] Scaffold `tests/contract/fal-sse-contract.test.ts` (use `msw` to simulate Fal queue).
- [ ] Add Playwright spec `tests/e2e/video-progress.spec.ts`.
- [ ] Script `scripts/smoke-fal-sse.sh` and integrate in GitHub Actions.
- [ ] Add Prometheus counter increments inside `/api/fal/stream`.
- [ ] Create `.cursor/rules/sse-proxy-health.mdc` from Section 5.

Once these are in place, a single `npm test` or CI run will *fast-forward* you past the debugging loop you experienced this week. 

## 7. Meta-Loop Prevention Framework

Even with bug-specific harnesses, teams fall into repeat confusion when **context, decisions, and hypotheses aren’t surfaced fast enough**.  Adopt these meta-practices to break loops across *any* feature:

1. **Decision Log on Every Merge**  
   – Continue using `/decisions/*.md`, but trigger a GitHub Action that fails the PR if a `COMMIT` cue isn’t present in the PR description.  
   – Enforce the template fields (scope, rationale, alternatives) via a simple Markdown lint.

2. **Context Summary Rotates Daily**  
   – A bot opens `docs/context-summary-YYYY-MM-DD.md` every morning with yesterday’s merged PR titles + open tasks, auto-closing the previous summary.  
   – Keeps everyone’s “mental RAM” in one file.

3. **Incident Kanban Column**  
   – When a loop begins (two back-and-forth cycles on Slack/Jira), move the card to **🔁 Feedback Loop**.  
   – Exit criteria: root-cause identified *and* guard-rail PR merged.

4. **Hypothesis-Checklist Stand-up**  
   – Verbally state *which* uncertainty you are trying to kill before touching code.  
   – Stand-up ends with: “If X fails, I will look at Y metric first.”

5. **Fail-Fast CI Stage**  
   – Ultra-cheap `npm run smoke` (≤3 s) runs `scripts/smoke-*.sh` for critical paths and blocks push if broken.  
   – Developers run this locally via pre-commit hook to get signal before PR.

6. **Abandon-Rate Alert**  
   – PagerDuty triggers when the same test fails *three* times across separate PRs in a week—signals systemic fragility.

7. **Learning Digest**  
   – Friday bot compiles bullet list: “What caused loops this week? Which guard-rails were added?”  
   – Auto-posts to #engineering-weekly, reinforcing collective memory.

These layers ensure we don’t just **patch the symptom**, we wire in the institutional memory that keeps similar loops from re-emerging six months later. 