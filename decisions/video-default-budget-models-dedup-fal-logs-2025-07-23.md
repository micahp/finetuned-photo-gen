# Decision – Default to Budget Video Models & Deduplicate Fal Logs (2025-07-23)

## Status
Accepted – implemented on 2025-07-23.

## Context
1. **Model selection UX** – The dashboard previously defaulted to premium-tier models (Veo 3 and Seedance Pro). This surprised users on initial page load and risked unintentional high-cost generations.
2. **Server-side log noise** – `/api/fal/stream` printed every progress line received from Fal.ai. Rapid-fire updates (e.g. download/write progress bars) produced hundreds of duplicate console lines per generation, drowning important errors.

## Decision
1. **Cheapest-first defaults**
   * In `src/app/dashboard/video/page.tsx`, the initial model is now the first **budget**-tier model for each mode.
   * Fallbacks: if no budget model exists, the overall cheapest model is selected.
2. **Fal log deduplication**
   * Added a `Set` of seen log messages inside `src/app/api/fal/stream/route.ts`.
   * Only unseen messages are printed to the server console; all messages are still streamed to the client.

## Consequences
* Users land on affordable models by default, reducing accidental credit burn.
* Production logs are markedly cleaner during video generation while preserving full client-side progress visibility.

## Follow-ups
* Consider persisting user’s last-used model preference in localStorage.
* Surface model tier (Premium / Standard / Budget) visually in the UI. 