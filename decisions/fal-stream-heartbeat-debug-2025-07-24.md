### [Decision 3]: Heartbeat events & raw packet dump for SSE debugging
**Timestamp (UTC):** 2025-07-24T00:00:00Z
**Scope:** src/app/api/fal/stream/route.ts, src/lib/fal-log-subscriber.ts
**Change Summary:** Added fallback `{type:'heartbeat'}` packets when Fal updates carry neither logs nor metrics, and temporarily dumped `[RAW]` packets in the subscriber for on-page verification.
**Rationale:** Some models emit long silent periods; the UI spinner stopped and appeared frozen. Heartbeat keeps the spinner alive, raw dump confirms end-to-end flow while we iterate.
**Alternatives Considered:**
  - Synthetic client-side spinner reset — hides real stalls.
  - Polling `/api/video/status` more aggressively — extra traffic.
**Trade-offs / Risks:**
  - Temporary console noise; must be removed once validated.
**Follow-ups / TODOs:**
  - Remove `[RAW]` console dump after confirmation.
  - Use heartbeat to drive indeterminate progress bar in UI.
**Source Prompt(s):** "add the dump" – user request to surface raw stream packets. 