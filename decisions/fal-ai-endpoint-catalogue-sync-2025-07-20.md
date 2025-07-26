### [Decision 1]: Sync Fal.ai endpoint catalogue
**Timestamp (UTC):** 2025-07-20T16:42:00Z  
**Scope:** `scripts/fal_api_endpoints_25.json`, `src/lib/video-models.ts`  
**Change Summary:** Added canonical 35-endpoint JSON list and appended 13 new `VideoModel` definitions (Fast-SVD, Pixverse, WAN, MiniMax, multiple LTX variants, Stable-Video T2V).  
**Rationale:** Keep internal catalogue fully aligned with Fal.ai offerings to avoid 404/400 errors and unlock new models for users.  
**Alternatives Considered:**  
  - Auto-fetch endpoints at runtime — *rejected* (latency, cache coherency).  
  - Maintain partial list until demand arises — *would block early adopters*.  
**Trade-offs / Risks:**  
  - Growing list increases maintenance overhead; mitigated by spec-diff CI.  
  - Provisional `costPerSecond` values may require later adjustment.  
**Follow-ups / TODOs:**  
  - Wire spec-diff script into CI gate.  
  - Update pricing table after product review.  
  - Expose new aspect ratios/durations in front-end selectors.  
**Source Prompt(s):** update fal_api_endpoints_25.json file and video-models.ts with this info 