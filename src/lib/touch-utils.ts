'use client';

import React from 'react';

// Touch event interfaces
export interface TouchPosition {
  x: number;
  y: number;
  timestamp: number;
}

export interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
  velocity: number;
  duration: number;
  startPosition: TouchPosition;
  endPosition: TouchPosition;
}

export interface TouchGestureOptions {
  minSwipeDistance?: number;
  maxSwipeTime?: number;
  minVelocity?: number;
  touchStartDelay?: number;
  preventScroll?: boolean;
  enableMomentum?: boolean;
}

export class TouchGestureHandler {
  private startTouch: TouchPosition | null = null;
  private lastTouch: TouchPosition | null = null;
  private touchHistory: TouchPosition[] = [];
  private options: Required<TouchGestureOptions>;
  private element: HTMLElement;
  private isTracking: boolean = false;
  private preventScrollTimeout: NodeJS.Timeout | null = null;

  // Event callbacks
  private onSwipeLeft?: () => void;
  private onSwipeRight?: () => void;
  private onSwipeUp?: () => void;
  private onSwipeDown?: () => void;
  private onTouchStart?: (position: TouchPosition) => void;
  private onTouchMove?: (position: TouchPosition, gesture: Partial<SwipeGesture>) => void;
  private onTouchEnd?: (gesture: SwipeGesture | null) => void;

  constructor(element: HTMLElement, options: TouchGestureOptions = {}) {
    this.element = element;
    this.options = {
      minSwipeDistance: options.minSwipeDistance ?? 50,
      maxSwipeTime: options.maxSwipeTime ?? 500,
      minVelocity: options.minVelocity ?? 0.3,
      touchStartDelay: options.touchStartDelay ?? 0,
      preventScroll: options.preventScroll ?? true,
      enableMomentum: options.enableMomentum ?? true,
    };

    this.attachEventListeners();
  }

  private attachEventListeners() {
    // Touch events
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });

    // Prevent context menu on touch devices
    this.element.addEventListener('contextmenu', this.preventContextMenu);

    // Prevent text selection during touch
    this.element.style.webkitUserSelect = 'none';
    this.element.style.userSelect = 'none';
    // @ts-ignore - webkitTouchCallout is a vendor-specific property
    this.element.style.webkitTouchCallout = 'none';
  }

  private removeEventListeners() {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchCancel);
    this.element.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private preventContextMenu = (e: Event) => {
    if (this.isTracking) {
      e.preventDefault();
    }
  };

  private getTouchPosition(touch: Touch): TouchPosition {
    return {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    };
  }

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const position = this.getTouchPosition(touch);

    this.startTouch = position;
    this.lastTouch = position;
    this.touchHistory = [position];
    this.isTracking = true;

    // Prevent scroll on touch start if enabled
    if (this.options.preventScroll) {
      this.preventScrollTimeout = setTimeout(() => {
        if (this.isTracking) {
          e.preventDefault();
        }
      }, this.options.touchStartDelay);
    }

    this.onTouchStart?.(position);
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.isTracking || e.touches.length !== 1 || !this.startTouch) return;

    const touch = e.touches[0];
    const position = this.getTouchPosition(touch);

    // Add to touch history for velocity calculation
    this.touchHistory.push(position);
    
    // Keep only recent history for momentum calculation
    const maxHistoryAge = 100; // 100ms
    this.touchHistory = this.touchHistory.filter(
      (pos) => position.timestamp - pos.timestamp <= maxHistoryAge
    );

    this.lastTouch = position;

    // Calculate current gesture state
    const deltaX = position.x - this.startTouch.x;
    const deltaY = position.y - this.startTouch.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = position.timestamp - this.startTouch.timestamp;

    const partialGesture: Partial<SwipeGesture> = {
      distance,
      duration,
      startPosition: this.startTouch,
    };

    // Prevent scroll if we've moved significantly horizontally
    if (this.options.preventScroll && Math.abs(deltaX) > 10) {
      e.preventDefault();
    }

    this.onTouchMove?.(position, partialGesture);
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (!this.isTracking || !this.startTouch || !this.lastTouch) {
      this.resetTouch();
      return;
    }

    const gesture = this.calculateGesture();
    this.resetTouch();

    if (gesture) {
      this.triggerSwipeCallbacks(gesture);
    }

    this.onTouchEnd?.(gesture);
  };

  private handleTouchCancel = () => {
    this.resetTouch();
    this.onTouchEnd?.(null);
  };

  private resetTouch() {
    this.startTouch = null;
    this.lastTouch = null;
    this.touchHistory = [];
    this.isTracking = false;

    if (this.preventScrollTimeout) {
      clearTimeout(this.preventScrollTimeout);
      this.preventScrollTimeout = null;
    }
  }

  private calculateGesture(): SwipeGesture | null {
    if (!this.startTouch || !this.lastTouch) return null;

    const deltaX = this.lastTouch.x - this.startTouch.x;
    const deltaY = this.lastTouch.y - this.startTouch.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = this.lastTouch.timestamp - this.startTouch.timestamp;

    // Check if gesture meets minimum requirements
    if (
      distance < this.options.minSwipeDistance ||
      duration > this.options.maxSwipeTime
    ) {
      return null;
    }

    // Calculate velocity using touch history for more accurate measurement
    const velocity = this.calculateVelocity();

    if (velocity < this.options.minVelocity) {
      return null;
    }

    // Determine direction based on dominant axis
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    let direction: SwipeGesture['direction'] = null;

    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      // Vertical swipe
      direction = deltaY > 0 ? 'down' : 'up';
    }

    return {
      direction,
      distance,
      velocity,
      duration,
      startPosition: this.startTouch,
      endPosition: this.lastTouch,
    };
  }

  private calculateVelocity(): number {
    if (this.touchHistory.length < 2) return 0;

    const recent = this.touchHistory.slice(-2);
    const [start, end] = recent;

    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const time = end.timestamp - start.timestamp;

    return time > 0 ? distance / time : 0;
  }

  private triggerSwipeCallbacks(gesture: SwipeGesture) {
    switch (gesture.direction) {
      case 'left':
        this.onSwipeLeft?.();
        break;
      case 'right':
        this.onSwipeRight?.();
        break;
      case 'up':
        this.onSwipeUp?.();
        break;
      case 'down':
        this.onSwipeDown?.();
        break;
    }
  }

  // Public methods for setting callbacks
  public setSwipeLeftCallback(callback: () => void) {
    this.onSwipeLeft = callback;
    return this;
  }

  public setSwipeRightCallback(callback: () => void) {
    this.onSwipeRight = callback;
    return this;
  }

  public setSwipeUpCallback(callback: () => void) {
    this.onSwipeUp = callback;
    return this;
  }

  public setSwipeDownCallback(callback: () => void) {
    this.onSwipeDown = callback;
    return this;
  }

  public setTouchStartCallback(callback: (position: TouchPosition) => void) {
    this.onTouchStart = callback;
    return this;
  }

  public setTouchMoveCallback(callback: (position: TouchPosition, gesture: Partial<SwipeGesture>) => void) {
    this.onTouchMove = callback;
    return this;
  }

  public setTouchEndCallback(callback: (gesture: SwipeGesture | null) => void) {
    this.onTouchEnd = callback;
    return this;
  }

  // Utility methods
  public updateOptions(newOptions: Partial<TouchGestureOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  public destroy() {
    this.removeEventListeners();
    this.resetTouch();
  }

  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }
}

// Hook for React components
export function useTouchGesture(
  elementRef: React.RefObject<HTMLElement>,
  options: TouchGestureOptions = {}
) {
  const [handler, setHandler] = React.useState<TouchGestureHandler | null>(null);

  React.useEffect(() => {
    if (!elementRef.current) return;

    const gestureHandler = new TouchGestureHandler(elementRef.current, options);
    setHandler(gestureHandler);

    return () => {
      gestureHandler.destroy();
    };
  }, [elementRef.current, JSON.stringify(options)]);

  return handler;
}

// Utility functions for device detection
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore
    navigator.msMaxTouchPoints > 0
  );
}

export function getDeviceOrientation(): 'portrait' | 'landscape' {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

export function addOrientationChangeListener(callback: (orientation: 'portrait' | 'landscape') => void) {
  const handleOrientationChange = () => {
    callback(getDeviceOrientation());
  };

  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('resize', handleOrientationChange);

  return () => {
    window.removeEventListener('orientationchange', handleOrientationChange);
    window.removeEventListener('resize', handleOrientationChange);
  };
}

// Performance utilities for mobile
export function requestIdleCallback(callback: () => void, timeout = 2000) {
  if ('requestIdleCallback' in window) {
    // @ts-ignore
    return window.requestIdleCallback(callback, { timeout });
  } else {
    return setTimeout(callback, 0);
  }
}

export function isSlowDevice(): boolean {
  // @ts-ignore
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (connection) {
    return (
      connection.effectiveType === 'slow-2g' ||
      connection.effectiveType === '2g' ||
      connection.saveData === true
    );
  }
  
  // Fallback: assume slow device if mobile and low hardware concurrency
  return (
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) &&
    navigator.hardwareConcurrency <= 2
  );
} 