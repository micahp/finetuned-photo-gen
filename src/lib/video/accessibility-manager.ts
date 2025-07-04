/**
 * Accessibility and reduced motion utilities for video playback
 */

/**
 * Accessibility and reduced motion utilities
 */
export class VideoAccessibilityManager {
  private prefersReducedMotion: boolean;

  constructor() {
    this.prefersReducedMotion = typeof window !== 'undefined' && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Listen for changes if we're in the browser
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        this.prefersReducedMotion = e.matches;
      });
    }
  }

  shouldAutoplay(): boolean {
    return !this.prefersReducedMotion;
  }

  getOptimalSettings() {
    return {
      autoplay: this.shouldAutoplay(),
      reduceAnimations: this.prefersReducedMotion,
      showControls: this.prefersReducedMotion // Show controls if motion is reduced
    };
  }
} 