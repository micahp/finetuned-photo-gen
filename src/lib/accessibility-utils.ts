/**
 * Accessibility utilities for video carousels and hero sections
 * Implements WCAG 2.1 Level AA guidelines
 */

// Keyboard navigation key constants
export const KEYBOARD_KEYS = {
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  HOME: 'Home',
  END: 'End',
  TAB: 'Tab',
} as const;

// User preference detection
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
}

// Screen reader detection utilities
export function detectScreenReader(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for common screen reader indicators
  const hasScreenReaderClass = document.documentElement.classList.contains('screenreader');
  const hasScreenReaderQuery = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  
  // Check for NVDA, JAWS, VoiceOver indicators
  const userAgent = navigator.userAgent.toLowerCase();
  const hasAccessibilityTools = /nvda|jaws|voiceover/.test(userAgent);
  
  return hasScreenReaderClass || hasScreenReaderQuery || hasHighContrast || hasAccessibilityTools;
}

// Focus management utilities
export function trapFocus(element: HTMLElement, firstFocusableElement?: HTMLElement, lastFocusableElement?: HTMLElement): () => void {
  const focusableElements = getFocusableElements(element);
  const first = firstFocusableElement || focusableElements[0];
  const last = lastFocusableElement || focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === KEYBOARD_KEYS.TAB) {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

export function getFocusableElements(element: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    'video[controls]',
    'audio[controls]',
  ].join(', ');

  return Array.from(element.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

export function setVisibleFocus(element: HTMLElement, visible: boolean = true): void {
  if (visible) {
    element.style.outline = '2px solid #00D4FF'; // PhotoAI cyan
    element.style.outlineOffset = '2px';
    element.style.borderRadius = '4px';
  } else {
    element.style.outline = 'none';
    element.style.outlineOffset = '';
  }
}

// Announcement utilities for screen readers
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof window === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Video accessibility utilities
export interface VideoAccessibilityOptions {
  includeTranscript?: boolean;
  includeAudioDescription?: boolean;
  captionsRequired?: boolean;
  autoplayAllowed?: boolean;
  respectReducedMotion?: boolean;
}

export function getVideoAccessibilityAttributes(
  video: HTMLVideoElement,
  options: VideoAccessibilityOptions = {}
): Record<string, string> {
  const attributes: Record<string, string> = {
    'aria-label': video.getAttribute('aria-label') || 'Video content',
    tabIndex: '0',
  };

  // Add description if available
  if (options.includeTranscript) {
    attributes['aria-describedby'] = `${video.id || 'video'}-transcript`;
  }

  if (options.includeAudioDescription) {
    attributes['aria-describedby'] = `${video.id || 'video'}-audio-description`;
  }

  // Respect user preferences
  if (options.respectReducedMotion && prefersReducedMotion()) {
    attributes['data-reduced-motion'] = 'true';
  }

  return attributes;
}

// Carousel keyboard navigation handler
export interface CarouselKeyboardOptions {
  onNext: () => void;
  onPrevious: () => void;
  onPause: () => void;
  onPlay: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  isPlaying: boolean;
  currentIndex: number;
  totalSlides: number;
}

export function handleCarouselKeyboardNavigation(
  event: KeyboardEvent,
  options: CarouselKeyboardOptions
): boolean {
  const { onNext, onPrevious, onPause, onPlay, onHome, onEnd, isPlaying } = options;

  switch (event.key) {
    case KEYBOARD_KEYS.ARROW_RIGHT:
      event.preventDefault();
      onNext();
      announceToScreenReader(`Moved to slide ${options.currentIndex + 2} of ${options.totalSlides}`);
      return true;

    case KEYBOARD_KEYS.ARROW_LEFT:
      event.preventDefault();
      onPrevious();
      announceToScreenReader(`Moved to slide ${options.currentIndex} of ${options.totalSlides}`);
      return true;

    case KEYBOARD_KEYS.SPACE:
    case KEYBOARD_KEYS.ENTER:
      event.preventDefault();
      if (isPlaying) {
        onPause();
        announceToScreenReader('Carousel paused');
      } else {
        onPlay();
        announceToScreenReader('Carousel playing');
      }
      return true;

    case KEYBOARD_KEYS.HOME:
      if (onHome) {
        event.preventDefault();
        onHome();
        announceToScreenReader('Moved to first slide');
        return true;
      }
      break;

    case KEYBOARD_KEYS.END:
      if (onEnd) {
        event.preventDefault();
        onEnd();
        announceToScreenReader('Moved to last slide');
        return true;
      }
      break;

    default:
      return false;
  }

  return false;
}

// High contrast theme utilities
export function getHighContrastStyles(): Record<string, string> {
  if (!prefersHighContrast()) return {};

  return {
    '--focus-color': '#FFFF00',
    '--text-color': '#FFFFFF',
    '--background-color': '#000000',
    '--border-color': '#FFFFFF',
    '--button-background': '#000080',
    '--button-text': '#FFFFFF',
  };
}

// Accessibility testing utilities (development only)
export function validateAccessibility(element: HTMLElement): {
  errors: string[];
  warnings: string[];
  suggestions: string[];
} {
  if (process.env.NODE_ENV !== 'development') {
    return { errors: [], warnings: [], suggestions: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for missing ARIA labels
  const buttons = element.querySelectorAll('button');
  buttons.forEach((button, index) => {
    if (!button.getAttribute('aria-label') && !button.getAttribute('aria-labelledby') && !button.textContent?.trim()) {
      errors.push(`Button ${index + 1} is missing accessible name`);
    }
  });

  // Check for missing roles
  if (!element.getAttribute('role')) {
    warnings.push('Container missing semantic role');
  }

  // Check for videos without captions
  const videos = element.querySelectorAll('video');
  videos.forEach((video, index) => {
    const tracks = video.querySelectorAll('track[kind="captions"], track[kind="subtitles"]');
    if (tracks.length === 0) {
      warnings.push(`Video ${index + 1} missing captions or subtitles`);
    }
  });

  // Check for focus indicators
  const focusableElements = getFocusableElements(element);
  focusableElements.forEach((el, index) => {
    const styles = window.getComputedStyle(el, ':focus');
    if (styles.outline === 'none' && styles.boxShadow === 'none') {
      suggestions.push(`Focusable element ${index + 1} missing visible focus indicator`);
    }
  });

  return { errors, warnings, suggestions };
}

// Export screen reader only CSS class utility
export const SCREEN_READER_ONLY_CLASS = 'sr-only';

// Utility to add screen reader only content
export function createScreenReaderOnlyElement(text: string): HTMLElement {
  const element = document.createElement('span');
  element.className = SCREEN_READER_ONLY_CLASS;
  element.textContent = text;
  element.setAttribute('aria-hidden', 'false');
  return element;
} 