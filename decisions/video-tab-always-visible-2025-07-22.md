### [Decision 1]: Always Show Video Tab (No Crown)
**Timestamp (UTC):** 2025-07-22T00:00:00Z
**Scope:** src/components/navigation/navbar.tsx
**Change Summary:** Removed premium gating on the Video navigation item, ensuring it appears for all users, and removed crown icon display entirely.
**Rationale:** Surfacing the Video feature encourages exploration; crown icon caused confusion and implied paywall. Premium enforcement remains in feature routes if required.
**Alternatives Considered:**
  - Keep premium gating — rejected; inconsistent with product direction.
**Trade-offs / Risks:** None significant; non-premium users will still be blocked when accessing the route server-side if necessary.
**Follow-ups / TODOs:** Review tests that asserted crown icon visibility and update accordingly.
**Source Prompt(s):** “on the navbar, let's always display the video tab, and let's not display a crown next to it at all” 