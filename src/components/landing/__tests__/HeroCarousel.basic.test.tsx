import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

// ----------- Mock heavy dependencies ----------- //

// Simplistic framer-motion mock – returns plain divs to avoid animation overhead
jest.mock('framer-motion', () => {
  const React = require('react')
  return {
    motion: new Proxy({}, {
      get: (_, key) => React.forwardRef(({ children, transition, ...rest }: any, ref) =>
        React.createElement('div', { 
          ...rest, 
          ref, 
          'data-motion-tag': key,
          // Force transition duration to 0 for tests
          transition: { ...transition, duration: 0 }
        }, children)
      )
    })
  }
})

// Mock video-optimisation utilities with safe fallbacks
jest.mock('@/lib/video-optimization', () => ({
  BandwidthEstimator: jest.fn().mockImplementation(() => ({ estimateBandwidth: jest.fn().mockResolvedValue(4000) })),
  VideoErrorHandler: jest.fn().mockImplementation(() => ({ handleVideoError: jest.fn() })),
  VideoAccessibilityManager: jest.fn().mockImplementation(() => ({
    // Set autoplay to false to prevent setInterval from running in tests
    getOptimalSettings: jest.fn().mockReturnValue({ autoplay: false, showControls: false, reduceAnimations: false })
  })),
  VideoPerformanceMonitor: jest.fn().mockImplementation(() => ({
    startLoading: jest.fn(),
    endLoading: jest.fn(),
    recordQualitySwitch: jest.fn(),
    recordBuffering: jest.fn(),
    getOverallQualityScore: jest.fn().mockReturnValue(100),
    recordError: jest.fn()
  })),
  getOptimalQuality: jest.fn().mockReturnValue('low')
}))

// Mock touch utilities – gestures aren't needed in JSDOM
jest.mock('@/lib/touch-utils', () => ({
  TouchGestureHandler: jest.fn().mockImplementation(() => ({
    setSwipeLeftCallback: jest.fn().mockReturnThis(),
    setSwipeRightCallback: jest.fn().mockReturnThis(),
    setTouchStartCallback: jest.fn().mockReturnThis(),
    setTouchEndCallback: jest.fn().mockReturnThis(),
    destroy: jest.fn()
  })),
  isTouchDevice: jest.fn().mockReturnValue(false),
  getDeviceOrientation: jest.fn().mockReturnValue('landscape'),
  addOrientationChangeListener: jest.fn().mockReturnValue(() => {}),
  isSlowDevice: jest.fn().mockReturnValue(false),
  // Ensure requestIdleCallback immediately executes its callback for tests
  requestIdleCallback: (cb: any) => cb()
}))

// Mock accessibility helpers we don't need to test core logic
jest.mock('@/lib/accessibility-utils', () => ({
  // Ensure keyboard navigation is mocked to allow progression
  handleCarouselKeyboardNavigation: jest.fn((event, options) => {
    if (event.key === 'ArrowRight' && options.onNext) {
      options.onNext();
      return true;
    }
    if (event.key === 'ArrowLeft' && options.onPrevious) {
      options.onPrevious();
      return true;
    }
    return false;
  }),
  announceToScreenReader: jest.fn(),
  // Ensure prefersReducedMotion is false to allow autoplay if enabled
  prefersReducedMotion: jest.fn().mockReturnValue(false),
  detectScreenReader: jest.fn().mockReturnValue(false),
  validateAccessibility: jest.fn(),
  getVideoAccessibilityAttributes: jest.fn(() => ({})),
  SCREEN_READER_ONLY_CLASS: 'sr-only'
}))

// ----------- Component under test ----------- //
import { HeroCarousel } from '../HeroCarousel'

describe('HeroCarousel (basic render)', () => {
  const sampleVideos = [
    {
      id: 'vid1',
      sources: [
        { url: '/videos/sample.mp4', type: 'video/mp4', quality: 'low' as const }
      ],
      thumbnail: '/thumb.jpg',
      title: 'Sample Video'
    },
    {
      id: 'vid2',
      sources: [
        { url: '/videos/sample2.mp4', type: 'video/mp4', quality: 'low' as const }
      ],
      thumbnail: '/thumb2.jpg',
      title: 'Second Video'
    }
  ]

  beforeAll(() => {
    // JSDOM lacks play/pause; stub them to avoid errors and ensure .catch works
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: jest.fn(() => Promise.resolve())
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: jest.fn() })
    Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: jest.fn() })
  })

  beforeEach(() => {
    jest.useFakeTimers(); // Use fake timers for the test
    // Clear mock calls for play/pause before each test
    (HTMLMediaElement.prototype.play as jest.Mock).mockClear();
    (HTMLMediaElement.prototype.pause as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers(); // Clear any pending timers
    jest.useRealTimers(); // Restore real timers
  });

  it('renders provided slides and allows arrow-key navigation', async () => {
    // Wrap render in act to handle initial state updates
    let container: HTMLElement
    await act(async () => {
      ({ container } = render(
        <HeroCarousel
          videos={sampleVideos}
          enableAutoplay={false} // Disable autoplay to prevent setInterval from running
          pauseOnHover={false}
        />
      ))
    })

    // Advance timers to let any initial useEffects (like bandwidth estimation) complete
    // We expect no infinite loop now that autoplay is disabled via mock
    await act(async () => {
      jest.runAllTimers();
    });

    // Initially, the first video should NOT attempt to play since autoplay is disabled
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    // pause might be called by the component on non-current videos, so we don't assert against it not being called

    const slide1 = screen.getByRole('group', { name: /slide 1 of 2/i })
    expect(slide1).toBeInTheDocument()
    expect(slide1).toHaveAttribute('aria-hidden', 'false')

    // Simulate right arrow key press to move to next slide and await the state change
    await act(async () => {
      fireEvent.keyDown(slide1.parentElement!, { key: 'ArrowRight' })
    })

    // After navigation, no new play/pause calls should occur since autoplay is disabled
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    // pause might be called again, but we only care that play is not called when autoplay is off

    // Use findByRole to wait for the second slide to become visible asynchronously
    const slide2 = await screen.findByRole('group', { name: /slide 2 of 2/i, hidden: false })
    expect(slide2).toBeInTheDocument()
    expect(slide2).toHaveAttribute('aria-hidden', 'false')

    // Ensure the first slide is now hidden
    const hiddenSlide1 = await screen.findByRole('group', { name: /slide 1 of 2/i, hidden: true })
    expect(hiddenSlide1).toBeInTheDocument()
    expect(hiddenSlide1).toHaveAttribute('aria-hidden', 'true')
  })
}) 