# Gallery View Design Philosophy & Future Enhancements

This document outlines the design decisions and potential future improvements for the gallery view, specifically concerning how media (images and videos) are displayed in the grid.

## Current Implementation: Square Grid (`aspect-square`)

The current gallery grid uses a fixed square aspect ratio for all media previews.

-   **Mechanism:** It uses `aspect-square` to force a 1:1 ratio and `object-cover` to make the media fill this square, cropping any excess.
-   **Pros:**
    -   **Uniformity:** Creates a perfectly aligned and clean grid.
    -   **Predictability:** Every card is the same size, which is easy for users to scan.
    -   **No Gaps:** Avoids a staggered or "masonry" look.
-   **Cons:**
    -   **Cropping:** Previews of non-square media (like 16:9 videos or 9:16 portraits) are cropped, so the user doesn't see the full image.

## Alternative Approaches Considered

### 1. "Contain" View (Letterboxing)

-   **Mechanism:** Use `object-contain` instead of `object-cover`. This fits the entire media preview inside the square, adding black bars to fill the remaining space.
-   **Pros:** Shows the full, un-cropped preview.
-   **Cons:** The black bars can be visually distracting and make the grid look less cohesive.

### 2. Dynamic Aspect Ratio (Masonry Grid)

-   **Mechanism:** Remove the fixed aspect ratio and allow each card's height to be determined by the media's natural dimensions.
-   **Pros:** The most "honest" representation, showing the full media without cropping or letterboxing.
-   **Cons:** Results in a staggered, uneven grid. This can be a desirable aesthetic but is a significant departure from the current clean design.

---

## Future Enhancements (Tasks)

Based on the current state, the following tasks have been identified to improve the gallery experience:

1.  **Implement an alternative 9:16 "Portrait" View Toggle:**
    -   **Description:** Add a view toggle to the gallery toolbar that allows users to switch the grid from the default 1:1 square view to a 9:16 portrait view. This would be ideal for users who primarily generate content for mobile formats.
    -   **Considerations:** This would likely still involve cropping for landscape media but would provide a better preview for portrait-oriented content.

2.  **Implement List View for Video Gallery:**
    -   **Description:** The image gallery has a "list view" option, but the video gallery currently does not. This task is to add the list view to the video tab to achieve feature parity.
    -   **Considerations:** The list view should display a small thumbnail, the prompt, and key metadata (duration, creation date, etc.) in a row-based format, similar to the image list view. 