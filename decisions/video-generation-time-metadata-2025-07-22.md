### [Decision 1]: Add approximate generation time metadata to video models & UI display
**Timestamp (UTC):** 2025-07-22T00:00:00Z
**Scope:** src/lib/video-models.ts, src/app/dashboard/video/page.tsx
**Change Summary:** Introduced `avgGenerationTimeMinutes` field to `VideoModel` interface, populated wait-time values for MAGI-1, WAN-2.1 variants, Pixverse v4.5 variants, and Hunyuan Custom 512; UI now shows “Gen Time” in model details.
**Rationale:** Surface realistic wait times so users can set expectations before generating videos, reducing support tickets about perceived slowness.
**Alternatives Considered:**
  - Calculate ETA dynamically via server-side job polling — deferred due to complexity.
  - Ignore wait-time data — rejected; poor UX.
**Trade-offs / Risks:**
  - Hard-coded times may drift as Fal improves performance; requires periodic refresh.
  - Adds another UI element; risk of clutter if too many details accumulate.
**Follow-ups / TODOs:**
  - Automate scraping of Fal “≈ time” values into harvester.
  - Implement dynamic backend estimation using historical job duration logs.
**Source Prompt(s):** here are the wait times for different models families… we need to add this info to our video models and come up with a way to display it 