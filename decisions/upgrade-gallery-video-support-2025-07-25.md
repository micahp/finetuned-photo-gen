### [Decision 6]: Suppress Share Cancellation Errors and Fix Empty `src` Warnings
**Timestamp (UTC):** 2024-07-26T18:35:00Z
**Scope:**
• `src/app/dashboard/gallery/page.tsx`
• `src/components/ui/smart-image.tsx`

**Change Summary:**
1. Wrapped `navigator.share()` calls within the gallery page in a `try...catch` block to gracefully handle the `AbortError` that occurs when a user cancels the native share dialog.
2. Modified the `SmartImage` component to return a placeholder or `null` if its `src` prop is an empty string, preventing the browser warning about re-requesting the page.
3. Updated `<video>` elements to use `undefined` instead of an empty string for the `poster` attribute when a thumbnail URL is missing, addressing the same warning.

**Rationale:**
These changes address two distinct frontend issues to improve robustness and eliminate console warnings. Suppressing the `AbortError` provides a cleaner console experience for a common user action (canceling a share). Preventing empty `src` and `poster` attributes fixes a browser warning and avoids unnecessary network requests, improving performance.

**Alternatives Considered:**
- For the share error: Leaving the unhandled promise rejection — rejected as it creates unnecessary noise in error logs and developer console.
- For the empty `src`: Relying on the component's `onError` handler — rejected because the browser issues the warning and makes the network request before the JavaScript error handler can execute.

**Trade-offs / Risks:**
- None. These are minor, low-risk fixes that improve frontend stability.

**Follow-ups / TODOs:**
- None.

**Source Prompt(s):**
"suppress this error AbortError: Share canceled."
"keep getting thsi error randomly. what is it about? An empty string ("") was passed to the src attribute."

### [Decision 5]: Refine Video Detail View Layout and Typography
**Timestamp (UTC):** 2024-07-26T18:03:00Z
**Scope:**
• `src/app/dashboard/gallery/page.tsx`

**Change Summary:**
1. Relocated the prompt display in the video detail modal to appear directly below the video player.
2. Adjusted the font size of the prompt text to `13px` for better visual hierarchy and to match user specifications.

**Rationale:**
The previous layout placed the prompt in the right-hand column, separating it from the video it described. Moving it directly below the video creates a more logical and intuitive grouping of related content. The font size adjustment provides finer control over the UI's typography.

**Alternatives Considered:**
- Keeping the prompt on the right side — rejected for a less intuitive user experience.
- Using a standard Tailwind text size (e.g., `text-xs` or `text-sm`) — rejected in favor of the precise `13px` value requested by the user.

**Trade-offs / Risks:**
- None. This is a minor,low-risk UI tweak.

**Follow-ups / TODOs:**
- [x] Enable video selection and bulk actions in the gallery grid.
- [x] Standardize video preview cards to match image styling.
- [x] Unify prompt styling in the image detail view to match the video view.
- [~] Enhance video metadata display in both grid and detail views. (Partially complete, prompt added to grid).
- [x] Document view alternatives and follow-up tasks in `docs/gallery-view-options.md` (2024-07-26).

**Source Prompt(s):**
"in the video detail view, let's move the prompt from the right side to below the video preview"
"change the font size for p tag that the prompt is inside in the gallery video detail view to 13px"

### [Decision 4]: Implement Infinite Scrolling in Gallery
**Timestamp (UTC):** 2025-07-25T22:00:00Z
**Scope:**
• `src/app/api/gallery/route.ts`
• `src/app/api/video/gallery/route.ts`
• `src/app/dashboard/gallery/page.tsx`

**Change Summary:**
1. **Backend:** Verified that both image and video gallery APIs support pagination (`page`, `limit`).
2. **Frontend:**
   - Implemented state to manage pagination for both image and video tabs (`imagePage`, `videoPage`, `hasMoreImages`, `hasMoreVideos`).
   - Used `IntersectionObserver` to detect when the user scrolls to the bottom of the list, triggering a fetch for the next page of results.
   - Modified fetch functions to append new items to the list, creating the infinite scroll effect.
   - Added a loading indicator that appears at the bottom of the grid when more items are being fetched.
   - Attached the `IntersectionObserver` ref to the **final video card**, fixing a bug that limited scrolling to the first page of videos.
   - Introduced `imageTotalCount` and `videoTotalCount` state to display **accurate total counts** in the gallery badges rather than the number of items currently rendered.
   - Added **list view layout** for videos, mirroring the image tab’s “Recent Activity” style with thumbnails, metadata, and quick actions.
   - Updated `<video>` elements to omit the `poster` attribute when no thumbnail is available, eliminating the *empty src* warning and related `AbortError`.

**Rationale:**
• Replaces the previous "load all" and tab-based loading models with a much more scalable and performant solution.
• Drastically improves the user experience for users with large numbers of generated images or videos by loading content on demand.

**Alternatives Considered:**
- "Load More" button — rejected in favor of the smoother, more modern user experience of infinite scrolling.

**Trade-offs / Risks:**
- A complex filter change could still require a full reset and reload, but this is an acceptable trade-off for the performance gains in the primary browsing use case.

**Follow-ups / TODOs:**
- Implement a skeleton loader for the initial loading state to prevent the "no content" flash.

**Source Prompt(s):**
“and what is the experience liek when the user has generated 100 images and 100 videos? do we wait for them all to load? is it lazy loading? or what?”

### [Decision 3]: Implement Lazy Loading for Gallery Tabs
**Timestamp (UTC):** 2025-07-25T21:00:00Z
**Scope:**
• `src/app/dashboard/gallery/page.tsx`

**Change Summary:**
1. Modified the gallery to fetch data only when a tab (Images or Videos) is active, preventing unnecessary loading of all assets at once.
2. Introduced `useRef` hooks (`imagesFetchedRef`, `videosFetchedRef`) to track the fetched state of each tab's data, avoiding redundant API calls on tab switching.
3. Ensured a loading indicator is displayed on each tab while its content is being fetched for the first time.

**Rationale:**
• Addresses a significant performance bottleneck where all images and videos were being fetched on page load, leading to a poor user experience for users with large galleries.
• Improves initial page load time and reduces unnecessary data transfer.

**Alternatives Considered:**
- Full infinite scrolling implementation — deferred in favor of this quicker, high-impact change. True infinite scrolling will be addressed as a separate, more involved task.

**Trade-offs / Risks:**
- This is an intermediate step. While it improves performance significantly, users with very large galleries (1000+ items) may still experience some sluggishness within a single tab.

**Follow-ups / TODOs:**
- Implement full infinite scrolling for a more robust solution.

**Source Prompt(s):**
“we gotta be smarter about how these thumbnails load. can't wait for every single image to load before going to the video tab like what the heck”

### [Decision 2]: Align Gallery UI and Add Video Detail Modal
**Timestamp (UTC):** 2025-07-25T20:15:00Z
**Scope:**
• `src/app/dashboard/gallery/page.tsx`

**Change Summary:**
1. Replaced the `Button`-based image/video toggle with a `Tabs` component to align with the Video Generation page's UI.
2. Implemented a detailed view modal for videos, achieving feature parity with the image gallery.
3. The modal displays the video player, prompt, generation parameters, and other metadata.
4. Includes actions for downloading, copying the prompt, and sharing the video.

**Rationale:**
• Fulfills user request for UI consistency across related pages.
• Improves user experience by providing detailed inspection capabilities for generated videos, matching the functionality available for images.

**Alternatives Considered:**
- Linking to a separate page for video details — rejected as a modal view provides a faster, more integrated experience without leaving the gallery context.

**Trade-offs / Risks:**
- Marginally increased component complexity in `gallery/page.tsx` is an acceptable trade-off for the significant feature enhancement.

**Follow-ups / TODOs:**
- None for this specific change.

**Source Prompt(s):**
“Design for image vs video toggle should match video gen page toggle. We should have feature parity on gallery page for images and video.”

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
- Initial gallery video tab lacks bulk actions & modal; staged for follow-up. (Now resolved)

**Follow-ups / TODOs:**
- ~Finish parity features for video list (bulk delete, share, details modal).~ (Completed)
- Add Playwright e2e covering tab switch + playback.
- Remove legacy SSE code once CI passes (`fal-log-subscriber`, `/api/fal/stream`).

**Source Prompt(s):**
“implement the next two open tasks in context summary … COMMIT” 