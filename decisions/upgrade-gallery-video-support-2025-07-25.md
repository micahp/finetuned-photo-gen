### [Decision 1]: Add video support to Gallery & Recent-Activity
**Timestamp (UTC):** 2025-07-25T18:42:00Z  
**Scope:**  
• `src/app/api/dashboard/stats/route.ts`  
• `src/app/dashboard/page.tsx`  
• `src/app/dashboard/gallery/page.tsx`  

**Change Summary:**  
1. Dashboard stats API now returns latest videos and merges them with images into a unified `recentActivity`.  
2. Dashboard UI renders video rows with an icon, thumbnail poster and external link.  
3. Gallery page gains a Images / Videos tab, fetches `/api/video/gallery`, re-uses filters, and displays inline `<video>` previews.

**Rationale:**  
• Users requested one place to view/manage generated videos (Decision log 2025-07-25).  
• Unifying the activity feed keeps dashboards consistent and surfacing videos alongside images improves discoverability.  

**Alternatives Considered:**  
- Separate “Video Gallery” route — rejected to avoid nav clutter.  
- Keeping activity feed image-only — rejected as inconsistent UX.  

**Trade-offs / Risks:**  
- Slightly heavier dashboard query (two additional DB calls) — mitigated with limits + combined post-processing.  
- Initial gallery video tab lacks bulk actions & modal; staged for follow-up.  

**Follow-ups / TODOs:**  
- Finish parity features for video list (bulk delete, share, details modal).  
- Add Playwright e2e covering tab switch + playback.  
- Remove legacy SSE code once CI passes (`fal-log-subscriber`, `/api/fal/stream`).  

**Source Prompt(s):**  
“implement the next two open tasks in context summary … COMMIT” 