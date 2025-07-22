# Fix API Response Field for Video Generation – 2025-07-22

## Context
The dashboard video player expected the backend to return a `videoUrl` field, whereas the synchronous branch of `/api/video/generate` was responding with `url`.  As a result the React page rendered nothing even though the file had been uploaded correctly to Cloudflare R2.

## Decision
1. Updated the API success payload to use `videoUrl` instead of `url` (`src/app/api/video/generate/route.ts`).
2. Confirmed that the async status endpoint already returns `videoUrl`, so no further changes were required.
3. Added debug logging & on-screen display of the resolved URL in `video/page.tsx` to aid future troubleshooting.

## Consequences
• Newly generated videos now appear immediately in the UI for both sync and async flows.
• No data migration needed—only runtime behaviour changed.
• Future API additions must align with the `GeneratedVideo` interface (`videoUrl`). 