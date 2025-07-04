# Hero Carousel Troubleshooting Guide

## Steps to Diagnose the Missing HeroCarousel Component

### 1. Verify the Component Export
Ensure that the `HeroCarousel` component is correctly exported from `src/components/landing/HeroCarousel.tsx`. The export should be:

```typescript
export function HeroCarousel({ ... }) { ... }
```

If it was exported as a default export, then the import in `src/app/page.tsx` should be:

```typescript
import HeroCarousel from '@/components/landing/HeroCarousel';
```

But if it was named export, then:

```typescript
import { HeroCarousel } from '@/components/landing/HeroCarousel';
```

Check the file `src/components/landing/HeroCarousel.tsx` for the correct export statement.

### 2. Check for Console Errors
Look for any JavaScript errors in the browser console that might indicate issues with the component loading.

### 3. Inspect the Network Tab
Verify that the HeroCarousel component and its dependencies are being loaded correctly. Check for any 404 errors.

### 4. Validate the Video Sources
The HeroCarousel component requires an array of video objects. Ensure that the provided video URLs are accessible and in a supported format.

### 5. Simplify the Component
Temporarily replace the HeroCarousel with a simple div and text to see if the layout adjusts and if there are any errors:

```tsx
<div className="bg-red-200 h-64 flex items-center justify-center">
  HeroCarousel Placeholder
</div>
```

If the placeholder appears, then the issue is with the HeroCarousel component itself. If not, there may be a layout or dependency issue.

### 6. Check CSS and Visibility
Inspect the element in the browser's developer tools to ensure it is not hidden due to CSS (e.g., `display: none`, `visibility: hidden`, or `opacity: 0`).

### 7. Review TypeScript Errors
If there are TypeScript errors, they might prevent the component from rendering. Check the console for any type-related errors.

### 8. Test in Different Browsers
Sometimes issues are specific to a particular browser. Test the page in multiple browsers.

### 9. Rollback Recent Changes
If the HeroCarousel was working previously, consider reverting to a previous version of the component to isolate the issue.

### 10. Contact Support
If you cannot resolve the issue, reach out to your team's frontend support channel for further assistance.

---

Let me know if you need any clarification or additional troubleshooting steps.