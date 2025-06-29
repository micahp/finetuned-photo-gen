'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BandwidthEstimator, 
  VideoErrorHandler, 
  VideoAccessibilityManager, 
  VideoPerformanceMonitor,
  getOptimalQuality
} from '@/lib/video-optimization';
import { 
  TouchGestureHandler, 
  isTouchDevice, 
  getDeviceOrientation,
  addOrientationChangeListener,
  isSlowDevice,
  requestIdleCallback 
} from '@/lib/touch-utils';
import {
  handleCarouselKeyboardNavigation,
  CarouselKeyboardOptions,
  announceToScreenReader,
  prefersReducedMotion,
  detectScreenReader,
  validateAccessibility,
  getVideoAccessibilityAttributes,
  SCREEN_READER_ONLY_CLASS
} from '@/lib/accessibility-utils';

interface VideoSource {
  url: string;
  type: string;
  resolution?: string;
  quality?: 'low' | 'medium' | 'high';
}

interface HeroCarouselProps {
  videos?: Array<{
    id: string;
    sources: VideoSource[]; // Multiple sources for different qualities
    url?: string; // Fallback for backwards compatibility
    thumbnail: string;
    title?: string;
    poster?: string;
    lowQualityPlaceholder?: string;
    description?: string; // For accessibility
    transcript?: string; // For accessibility
  }>;
  autoplayInterval?: number;
  className?: string;
  pauseOnHover?: boolean;
  enableAutoplay?: boolean;
  enableAdaptiveQuality?: boolean;
  preloadStrategy?: 'auto' | 'metadata' | 'none';
  ariaLabel?: string; // Custom accessible name for the carousel
}

// Detect user connection quality
const useConnectionQuality = () => {
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('medium');

  useEffect(() => {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      const updateQuality = () => {
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') {
          setQuality('high');
        } else if (effectiveType === '3g') {
          setQuality('medium');
        } else {
          setQuality('low');
        }
      };
      
      updateQuality();
      connection.addEventListener('change', updateQuality);
      
      return () => connection.removeEventListener('change', updateQuality);
    }
  }, []);

  return quality;
};

// Detect device type
const useDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    return () => window.removeEventListener('resize', checkDeviceType);
  }, []);

  return deviceType;
};

export function HeroCarousel({ 
  videos = [], 
  autoplayInterval = 5000,
  className = '',
  pauseOnHover = true,
  enableAutoplay = true,
  enableAdaptiveQuality = true,
  preloadStrategy = 'metadata',
  ariaLabel
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCarouselPlaying, setIsCarouselPlaying] = useState(enableAutoplay);
  const [isHovered, setIsHovered] = useState(false);
  const [loadedVideos, setLoadedVideos] = useState<Set<number>>(new Set());
  const [estimatedBandwidth, setEstimatedBandwidth] = useState<number>(0);
  const [videoQualityMap, setVideoQualityMap] = useState<Map<string, 'low' | 'medium' | 'high'>>(new Map());
  
  // Accessibility state
  const [hasFocus, setHasFocus] = useState(false);
  const [announceSlideChange, setAnnounceSlideChange] = useState(true);
  const [isScreenReaderDetected, setIsScreenReaderDetected] = useState(false);
  const [reducedMotionPreference, setReducedMotionPreference] = useState(false);
  
  // Mobile and touch state
  const [isTouchEnabled, setIsTouchEnabled] = useState(false);
  const [deviceOrientation, setDeviceOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const carouselIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadStartTimes = useRef<Map<number, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const touchHandler = useRef<TouchGestureHandler | null>(null);
  
  // Enhanced optimization utilities
  const bandwidthEstimator = useRef(new BandwidthEstimator());
  const errorHandler = useRef(new VideoErrorHandler());
  const accessibilityManager = useRef(new VideoAccessibilityManager());
  const performanceMonitor = useRef(new VideoPerformanceMonitor());
  
  const connectionQuality = useConnectionQuality();
  const deviceType = useDeviceType();

  // Initialize mobile detection and touch support
  useEffect(() => {
    setIsTouchEnabled(isTouchDevice());
    setDeviceOrientation(getDeviceOrientation());
    setIsSlowConnection(isSlowDevice());

    // Initialize accessibility settings
    setIsScreenReaderDetected(detectScreenReader());
    setReducedMotionPreference(prefersReducedMotion());

    // Listen for orientation changes
    const removeOrientationListener = addOrientationChangeListener((orientation) => {
      setDeviceOrientation(orientation);
    });

    // Listen for reduced motion preference changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotionPreference(e.matches);
      if (e.matches && isCarouselPlaying) {
        setIsCarouselPlaying(false);
        announceToScreenReader('Carousel paused due to reduced motion preference');
      }
    };
    mediaQuery.addEventListener('change', handleMotionChange);

    return () => {
      removeOrientationListener();
      mediaQuery.removeEventListener('change', handleMotionChange);
    };
  }, [isCarouselPlaying]);

  // Initialize touch gesture handling
  useEffect(() => {
    if (!containerRef.current || !isTouchEnabled) return;

    const touchOptions = {
      minSwipeDistance: deviceType === 'mobile' ? 30 : 50,
      maxSwipeTime: 600,
      minVelocity: 0.2,
      preventScroll: true,
      enableMomentum: true,
    };

    touchHandler.current = new TouchGestureHandler(containerRef.current, touchOptions);

    touchHandler.current
      .setSwipeLeftCallback(() => {
        if (videos.length > 1) {
          const nextIndex = (currentIndex + 1) % videos.length;
          setCurrentIndex(nextIndex);
        }
      })
      .setSwipeRightCallback(() => {
        if (videos.length > 1) {
          const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
          setCurrentIndex(prevIndex);
        }
      })
      .setTouchStartCallback(() => {
        setIsSwiping(true);
        // Pause carousel during swipe
        if (isCarouselPlaying) {
          setIsCarouselPlaying(false);
        }
      })
      .setTouchEndCallback((gesture) => {
        setIsSwiping(false);
        // Resume carousel after swipe if it was playing
        if (enableAutoplay && !gesture) {
          requestIdleCallback(() => {
            setIsCarouselPlaying(true);
          });
        }
      });

    return () => {
      touchHandler.current?.destroy();
    };
  }, [currentIndex, videos.length, isCarouselPlaying, enableAutoplay, deviceType, isTouchEnabled]);

  // Initialize bandwidth estimation
  useEffect(() => {
    const estimateBandwidth = async () => {
      try {
        const bandwidth = await bandwidthEstimator.current.estimateBandwidth();
        setEstimatedBandwidth(bandwidth);
      } catch (error) {
        console.warn('Bandwidth estimation failed:', error);
      }
    };

    estimateBandwidth();
  }, []);

  // Handle video references
  const setVideoRef = (el: HTMLVideoElement | null, index: number) => {
    videoRefs.current[index] = el;
  };

  // Get optimal video source based on connection quality, bandwidth, and device
  const getOptimalVideoSource = useCallback((video: HeroCarouselProps['videos'][0], containerWidth?: number) => {
    if (!video.sources || video.sources.length === 0) {
      return video.url; // Fallback to single source
    }

    if (!enableAdaptiveQuality) {
      return video.sources[0].url; // Return first available source
    }

    // Determine target quality based on multiple factors
    const optimalQuality = getOptimalQuality(estimatedBandwidth, connectionQuality, deviceType);
    
    // Cache the quality decision for this video
    setVideoQualityMap(prev => new Map(prev.set(video.id, optimalQuality)));

    // Find best matching source
    const qualitySource = video.sources.find(source => source.quality === optimalQuality);
    if (qualitySource) return qualitySource.url;

    // Fallback to first available source
    return video.sources[0].url;
  }, [estimatedBandwidth, connectionQuality, deviceType, enableAdaptiveQuality]);

  // Enhanced video loading with placeholder support
  const loadVideoWithPlaceholder = useCallback(async (video: HeroCarouselProps['videos'][0], videoElement: HTMLVideoElement) => {
    try {
      // Start with low-quality placeholder if available
      if (video.lowQualityPlaceholder && estimatedBandwidth < 1500) {
        videoElement.src = video.lowQualityPlaceholder;
        videoElement.load();
        
        // Wait for placeholder to load, then upgrade to optimal quality
        const upgradeToOptimal = () => {
          const optimalSrc = getOptimalVideoSource(video);
          if (optimalSrc && optimalSrc !== video.lowQualityPlaceholder) {
            setTimeout(() => {
              videoElement.src = optimalSrc;
              videoElement.load();
              performanceMonitor.current.recordQualitySwitch(video.id);
            }, 500); // Small delay to ensure placeholder plays
          }
        };

        videoElement.addEventListener('loadeddata', upgradeToOptimal, { once: true });
      } else {
        // Load optimal quality directly for good connections
        const optimalSrc = getOptimalVideoSource(video);
        if (optimalSrc) {
          videoElement.src = optimalSrc;
          videoElement.load();
        }
      }
    } catch (error) {
      console.error('Error loading video:', error);
      await errorHandler.current.handleVideoError(videoElement, video.id, video.sources);
    }
  }, [getOptimalVideoSource, estimatedBandwidth]);

  // Enhanced preload strategy for mobile devices
  const preloadAdjacentVideos = useCallback(() => {
    if (!enableAutoplay || videos.length <= 1) return;

    const nextIndex = (currentIndex + 1) % videos.length;
    const prevIndex = (currentIndex - 1 + videos.length) % videos.length;

    // Mobile-optimized preloading strategy
    const shouldPreloadPrevious = !isSlowConnection && 
      connectionQuality !== 'low' && 
      deviceType !== 'mobile';

    // Always preload next video (higher priority)
    if (!loadedVideos.has(nextIndex)) {
      const nextVideo = videoRefs.current[nextIndex];
      const nextVideoData = videos[nextIndex];
      if (nextVideo && nextVideoData && nextVideo.readyState < 2) {
        // Use low-quality placeholder for mobile on slow connections
        if (deviceType === 'mobile' && isSlowConnection) {
          requestIdleCallback(() => {
            loadVideoWithPlaceholder(nextVideoData, nextVideo);
          });
        } else {
          loadVideoWithPlaceholder(nextVideoData, nextVideo);
        }
      }
    }

    // Preload previous video only on desktop or fast connections
    if (shouldPreloadPrevious && !loadedVideos.has(prevIndex)) {
      const prevVideo = videoRefs.current[prevIndex];
      const prevVideoData = videos[prevIndex];
      if (prevVideo && prevVideoData && prevVideo.readyState < 2) {
        requestIdleCallback(() => {
          loadVideoWithPlaceholder(prevVideoData, prevVideo);
        }, 1000);
      }
    }
  }, [currentIndex, videos, loadedVideos, connectionQuality, enableAutoplay, loadVideoWithPlaceholder, isSlowConnection, deviceType]);

  // Auto-advance carousel with accessibility consideration
  useEffect(() => {
    const accessibilitySettings = accessibilityManager.current.getOptimalSettings();
    
    if (!accessibilitySettings.autoplay || !isCarouselPlaying || videos.length <= 1 || (pauseOnHover && isHovered)) {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
        carouselIntervalRef.current = null;
      }
      return;
    }
    
    carouselIntervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % videos.length);
    }, autoplayInterval);

    return () => {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
    };
  }, [isCarouselPlaying, videos.length, autoplayInterval, isHovered, pauseOnHover]);

  // Handle video playback when current index changes
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === currentIndex) {
          // Play current video with accessibility check
          const accessibilitySettings = accessibilityManager.current.getOptimalSettings();
          video.currentTime = 0; // Reset to beginning
          
          if (accessibilitySettings.autoplay) {
            video.play().catch(console.error);
          }
        } else {
          // Pause other videos
          video.pause();
        }
      }
    });

    // Preload adjacent videos after a short delay
    const preloadTimer = setTimeout(preloadAdjacentVideos, 500);
    return () => clearTimeout(preloadTimer);
  }, [currentIndex, preloadAdjacentVideos]);

  // Handle mouse events for pause on hover
  const handleMouseEnter = () => {
    if (pauseOnHover) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (pauseOnHover) {
      setIsHovered(false);
    }
  };

  // Enhanced video load handler with performance monitoring
  const handleVideoLoad = (video: HTMLVideoElement, index: number) => {
    // Ensure video is properly configured
    video.muted = true;
    video.playsInline = true;
    video.loop = true;

    // Record load time if we have a start time
    const startTime = loadStartTimes.current.get(index);
    if (startTime) {
      performanceMonitor.current.endLoading(videos[index].id);
      loadStartTimes.current.delete(index);
    }

    // Mark video as loaded
    setLoadedVideos(prev => new Set([...prev, index]));
  };

  // Handle video loading start with performance monitoring
  const handleVideoLoadStart = (index: number) => {
    loadStartTimes.current.set(index, performance.now());
    performanceMonitor.current.startLoading(videos[index].id);
  };

  // Enhanced error handling
  const handleVideoError = async (error: any, index: number) => {
    console.error(`Video ${index} failed to load:`, error);
    performanceMonitor.current.recordError(videos[index].id);
    
    const video = videoRefs.current[index];
    const videoData = videos[index];
    
    if (video && videoData) {
      const success = await errorHandler.current.handleVideoError(video, videoData.id, videoData.sources);
      if (!success) {
        // Show fallback content or poster
        video.poster = videoData.poster || videoData.thumbnail;
      }
    }
  };

  // Handle buffering events with duration tracking
  const handleVideoWaiting = (index: number) => {
    const stallStart = performance.now();
    
    const handleStallEnd = () => {
      const stallDuration = performance.now() - stallStart;
      performanceMonitor.current.recordBuffering(videos[index].id, stallDuration);
      videoRefs.current[index]?.removeEventListener('playing', handleStallEnd);
    };
    
    videoRefs.current[index]?.addEventListener('playing', handleStallEnd, { once: true });
  };

  // Manual navigation
  const goToSlide = (index: number) => {
    if (index >= 0 && index < videos.length && index !== currentIndex) {
      setCurrentIndex(index);
      if (announceSlideChange) {
        announceToScreenReader(`Moved to slide ${index + 1} of ${videos.length}: ${videos[index]?.title || 'Video'}`);
      }
    }
  };

  const toggleCarouselPlayback = () => {
    const newPlayingState = !isCarouselPlaying;
    setIsCarouselPlaying(newPlayingState);
    
    // Announce state change
    if (announceSlideChange) {
      announceToScreenReader(newPlayingState ? 'Carousel playing' : 'Carousel paused');
    }
  };

  // Navigation functions for keyboard handling
  const goToNextSlide = useCallback(() => {
    const nextIndex = (currentIndex + 1) % videos.length;
    goToSlide(nextIndex);
  }, [currentIndex, videos.length]);

  const goToPreviousSlide = useCallback(() => {
    const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
    goToSlide(prevIndex);
  }, [currentIndex, videos.length]);

  const goToFirstSlide = useCallback(() => {
    goToSlide(0);
  }, []);

  const goToLastSlide = useCallback(() => {
    goToSlide(videos.length - 1);
  }, [videos.length]);

  // Keyboard navigation handler
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    if (!hasFocus) return;

    const keyboardOptions: CarouselKeyboardOptions = {
      onNext: goToNextSlide,
      onPrevious: goToPreviousSlide,
      onPause: () => setIsCarouselPlaying(false),
      onPlay: () => setIsCarouselPlaying(true),
      onHome: goToFirstSlide,
      onEnd: goToLastSlide,
      isPlaying: isCarouselPlaying,
      currentIndex,
      totalSlides: videos.length,
    };

    const handled = handleCarouselKeyboardNavigation(event, keyboardOptions);
    
    // Additional keyboard handling for accessibility
    if (!handled && event.key === 'Tab') {
      // Allow tab navigation but pause carousel temporarily
      if (isCarouselPlaying) {
        setIsCarouselPlaying(false);
        setTimeout(() => {
          if (!hasFocus) setIsCarouselPlaying(true);
        }, 3000); // Resume after 3 seconds if focus leaves
      }
    }
  }, [
    hasFocus,
    goToNextSlide,
    goToPreviousSlide,
    goToFirstSlide,
    goToLastSlide,
    isCarouselPlaying,
    currentIndex,
    videos.length,
  ]);

  // Focus management
  const handleFocus = useCallback(() => {
    setHasFocus(true);
    if (isCarouselPlaying && (pauseOnHover || isScreenReaderDetected)) {
      setIsCarouselPlaying(false);
    }
  }, [isCarouselPlaying, pauseOnHover, isScreenReaderDetected]);

  const handleBlur = useCallback(() => {
    setHasFocus(false);
    // Resume autoplay after a brief delay if it was originally enabled
    if (enableAutoplay && !reducedMotionPreference) {
      setTimeout(() => {
        if (!hasFocus && !isHovered) {
          setIsCarouselPlaying(true);
        }
      }, 1000);
    }
  }, [enableAutoplay, reducedMotionPreference, hasFocus, isHovered]);

  // Add keyboard navigation support
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.addEventListener('keydown', handleKeyboardNavigation);
    container.addEventListener('focus', handleFocus);
    container.addEventListener('blur', handleBlur);

    return () => {
      container.removeEventListener('keydown', handleKeyboardNavigation);
      container.removeEventListener('focus', handleFocus);
      container.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyboardNavigation, handleFocus, handleBlur]);

  // Determine preload value based on strategy and position
  const getPreloadValue = (index: number) => {
    if (index === currentIndex) return 'auto';
    if (preloadStrategy === 'auto') return 'auto';
    return preloadStrategy;
  };

  // Accessibility settings
  const accessibilitySettings = accessibilityManager.current.getOptimalSettings();

  return (
    <motion.div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden rounded-lg focus-visible ${className} ${
        isSwiping ? 'cursor-grabbing' : isTouchEnabled ? 'cursor-grab' : ''
      }`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: reducedMotionPreference ? 0 : 0.5,
        ease: "easeOut"
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-label={ariaLabel || "Video carousel"}
      aria-describedby="carousel-instructions"
      aria-roledescription="carousel"
      tabIndex={0}
      style={{
        // Optimize for touch devices
        touchAction: isTouchEnabled ? 'pan-y pinch-zoom' : 'auto',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Screen reader instructions */}
      <div id="carousel-instructions" className={SCREEN_READER_ONLY_CLASS}>
        Use arrow keys to navigate between slides. Press space to pause or play the carousel. 
        Press home to go to the first slide, end for the last slide.
        {videos.length > 0 && ` Currently showing slide ${currentIndex + 1} of ${videos.length}.`}
      </div>

      {/* Live region for announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className={SCREEN_READER_ONLY_CLASS}
        id="carousel-announcements"
      />

      {/* Video Container */}
      <div 
        className="relative w-full h-full bg-photoai-dark"
        role="group"
        aria-label="Video slides"
      >
        {videos.length > 0 ? (
          videos.map((video, index) => (
            <motion.div
              key={video.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: index === currentIndex ? 1 : 0 }}
              transition={{ 
                duration: reducedMotionPreference ? 0 : 0.5,
                ease: "easeInOut"
              }}
              role="group"
              aria-label={`Slide ${index + 1} of ${videos.length}`}
              aria-hidden={index !== currentIndex}
            >
              <video
                ref={(el) => setVideoRef(el, index)}
                className="w-full h-full object-cover"
                autoPlay={index === currentIndex && accessibilitySettings.autoplay && !reducedMotionPreference}
                muted
                playsInline
                loop
                poster={video.poster || video.thumbnail}
                onLoadedData={(e) => handleVideoLoad(e.currentTarget, index)}
                onLoadStart={() => handleVideoLoadStart(index)}
                onError={(e) => handleVideoError(e, index)}
                onWaiting={() => handleVideoWaiting(index)}
                preload={getPreloadValue(index)}
                crossOrigin="anonymous"
                controls={accessibilitySettings.showControls}
                aria-label={`${video.title || `Video ${index + 1}`}${video.description ? `. ${video.description}` : ''}`}
                aria-describedby={video.transcript ? `transcript-${video.id}` : undefined}
                tabIndex={index === currentIndex ? 0 : -1}
                {...getVideoAccessibilityAttributes(
                  videoRefs.current[index] || document.createElement('video'),
                  {
                    includeTranscript: !!video.transcript,
                    respectReducedMotion: true,
                    autoplayAllowed: !reducedMotionPreference,
                  }
                )}
              >
                {/* Multiple source support for optimal delivery */}
                {video.sources && video.sources.length > 0 ? (
                  video.sources.map((source, sourceIndex) => (
                    <source 
                      key={sourceIndex}
                      src={source.url} 
                      type={source.type}
                    />
                  ))
                ) : (
                  <source src={getOptimalVideoSource(video)} type="video/mp4" />
                )}
                
                {/* Fallback content */}
                <div className="w-full h-full bg-gradient-to-br from-photoai-accent-cyan/10 to-photoai-accent-purple/10 flex items-center justify-center">
                  <p className="text-white/80 text-sm">Video not supported</p>
                </div>
              </video>
              
              {/* Video overlay for better text readability */}
              <div className="absolute inset-0 bg-black/20" />

              {/* Video transcript for accessibility */}
              {video.transcript && (
                <div 
                  id={`transcript-${video.id}`}
                  className={SCREEN_READER_ONLY_CLASS}
                >
                  Video transcript: {video.transcript}
                </div>
              )}
              
              {/* Loading indicator for current video */}
              {index === currentIndex && !loadedVideos.has(index) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="w-8 h-8 border-2 border-photoai-accent-cyan border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Quality indicator in development mode */}
              {process.env.NODE_ENV === 'development' && index === currentIndex && (
                <div className="absolute top-16 left-4 text-xs text-white/60 bg-black/50 p-2 rounded">
                  <div>Quality: {videoQualityMap.get(video.id) || 'auto'}</div>
                  <div>Bandwidth: {Math.round(estimatedBandwidth)}kbps</div>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          // Placeholder content when no videos
          <div className="w-full h-full bg-gradient-to-br from-photoai-accent-cyan/10 to-photoai-accent-purple/10 flex items-center justify-center">
            <div className="text-center space-y-4">
              <motion.div 
                className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="w-0 h-0 border-l-8 border-l-white border-t-4 border-t-transparent border-b-4 border-b-transparent ml-1" />
              </motion.div>
              <p className="text-white/80 text-sm">Hero Carousel Placeholder</p>
              <div className="neon-label">Coming Soon</div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Navigation Arrows - Visible on Touch Devices */}
      {isTouchEnabled && videos.length > 1 && deviceType === 'mobile' && (
        <>
          <button
            onClick={goToPreviousSlide}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 active:bg-black/80 rounded-full flex items-center justify-center transition-colors z-10 focus-visible"
            aria-label={`Previous slide. Currently on slide ${currentIndex + 1} of ${videos.length}${videos[currentIndex]?.title ? `: ${videos[currentIndex].title}` : ''}`}
            aria-describedby="carousel-instructions"
            tabIndex={0}
            style={{
              minWidth: '44px',
              minHeight: '44px',
            }}
          >
            <div className="w-0 h-0 border-r-4 border-r-white border-t-3 border-t-transparent border-b-3 border-b-transparent mr-1" />
            <span className={SCREEN_READER_ONLY_CLASS}>Previous slide</span>
          </button>
          
          <button
            onClick={goToNextSlide}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 active:bg-black/80 rounded-full flex items-center justify-center transition-colors z-10 focus-visible"
            aria-label={`Next slide. Currently on slide ${currentIndex + 1} of ${videos.length}${videos[currentIndex]?.title ? `: ${videos[currentIndex].title}` : ''}`}
            aria-describedby="carousel-instructions"
            tabIndex={0}
            style={{
              minWidth: '44px',
              minHeight: '44px',
            }}
          >
            <div className="w-0 h-0 border-l-4 border-l-white border-t-3 border-t-transparent border-b-3 border-b-transparent ml-1" />
            <span className={SCREEN_READER_ONLY_CLASS}>Next slide</span>
          </button>
        </>
      )}

      {/* Enhanced Navigation Dots - Touch Optimized with Accessibility */}
      {videos.length > 1 && (
        <div 
          className={`absolute ${
            deviceType === 'mobile' ? 'bottom-6' : 'bottom-4'
          } left-1/2 transform -translate-x-1/2 flex ${
            deviceType === 'mobile' ? 'space-x-4' : 'space-x-2'
          }`}
          role="tablist"
          aria-label="Slide navigation"
          aria-describedby="carousel-instructions"
        >
          {videos.map((video, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`${
                deviceType === 'mobile' ? 'w-3 h-3 p-2' : 'w-2 h-2'
              } rounded-full transition-all duration-300 focus-visible ${
                index === currentIndex 
                  ? 'bg-photoai-accent-cyan shadow-lg shadow-photoai-accent-cyan/50' 
                  : 'bg-white/30 hover:bg-white/50 active:bg-white/70'
              } ${
                deviceType === 'mobile' 
                  ? 'min-w-[44px] min-h-[44px] flex items-center justify-center' 
                  : ''
              }`}
              aria-label={`Go to slide ${index + 1}${video.title ? `: ${video.title}` : ''}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
              aria-selected={index === currentIndex}
              role="tab"
              tabIndex={index === currentIndex ? 0 : -1}
              style={{
                // Ensure minimum touch target size (44px)
                minWidth: deviceType === 'mobile' ? '44px' : 'auto',
                minHeight: deviceType === 'mobile' ? '44px' : 'auto',
              }}
            >
              {deviceType === 'mobile' && (
                <div className={`w-3 h-3 rounded-full ${
                  index === currentIndex 
                    ? 'bg-photoai-accent-cyan' 
                    : 'bg-white/50'
                }`} />
              )}
              <span className={SCREEN_READER_ONLY_CLASS}>
                Slide {index + 1} of {videos.length}
                {index === currentIndex && ' (current)'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Enhanced Play/Pause Control - Touch Optimized with Full Accessibility */}
      {enableAutoplay && (
        <button
          onClick={toggleCarouselPlayback}
          className={`absolute ${
            deviceType === 'mobile' ? 'top-4 right-4 w-12 h-12' : 'top-4 right-4 w-8 h-8'
          } bg-black/50 hover:bg-black/70 active:bg-black/80 rounded-full flex items-center justify-center transition-colors focus-visible z-20`}
          aria-label={`${isCarouselPlaying ? 'Pause' : 'Play'} carousel autoplay. Currently ${isCarouselPlaying ? 'playing' : 'paused'}.`}
          aria-pressed={isCarouselPlaying}
          aria-describedby="carousel-instructions"
          tabIndex={0}
          style={{
            // Ensure minimum touch target size
            minWidth: deviceType === 'mobile' ? '44px' : 'auto',
            minHeight: deviceType === 'mobile' ? '44px' : 'auto',
          }}
        >
          {isCarouselPlaying ? (
            <>
              <div className={`${
                deviceType === 'mobile' ? 'w-4 h-4' : 'w-3 h-3'
              } flex space-x-0.5 items-center justify-center`}>
                <div className={`${
                  deviceType === 'mobile' ? 'w-1.5 h-4' : 'w-1 h-3'
                } bg-white rounded-sm`}></div>
                <div className={`${
                  deviceType === 'mobile' ? 'w-1.5 h-4' : 'w-1 h-3'
                } bg-white rounded-sm`}></div>
              </div>
              <span className={SCREEN_READER_ONLY_CLASS}>Pause autoplay</span>
            </>
          ) : (
            <>
              <div className={`w-0 h-0 ${
                deviceType === 'mobile' 
                  ? 'border-l-4 border-l-white border-t-3 border-t-transparent border-b-3 border-b-transparent ml-1' 
                  : 'border-l-3 border-l-white border-t-2 border-t-transparent border-b-2 border-b-transparent ml-0.5'
              }`} />
              <span className={SCREEN_READER_ONLY_CLASS}>Resume autoplay</span>
            </>
          )}
        </button>
      )}

      {/* Enhanced Performance Indicator (dev mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className={`absolute ${
          deviceType === 'mobile' ? 'top-16 left-2 text-[10px]' : 'top-4 left-4 text-xs'
        } text-white/60 bg-black/50 p-2 rounded space-y-1 ${
          deviceType === 'mobile' ? 'max-w-[200px]' : ''
        }`}>
          <div>Connection: {connectionQuality}</div>
          <div>Device: {deviceType}</div>
          <div>Orientation: {deviceOrientation}</div>
          <div>Touch: {isTouchEnabled ? 'Yes' : 'No'}</div>
          <div>Slow Device: {isSlowConnection ? 'Yes' : 'No'}</div>
          <div>Swiping: {isSwiping ? 'Yes' : 'No'}</div>
          <div>Loaded: {loadedVideos.size}/{videos.length}</div>
          <div>Bandwidth: {Math.round(estimatedBandwidth)}kbps</div>
          <div>Quality Score: {Math.round(performanceMonitor.current.getOverallQualityScore())}</div>
          <div>Reduced Motion: {accessibilitySettings.reduceAnimations ? 'Yes' : 'No'}</div>
        </div>
      )}

      {/* Accessible Loading progress bar */}
      {videos.length > 0 && accessibilitySettings.autoplay && (
        <div 
          className="absolute bottom-1 left-4 right-4"
          role="progressbar"
          aria-label="Slide transition progress"
          aria-valuenow={isCarouselPlaying && !isHovered ? 50 : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-hidden={!isCarouselPlaying || isHovered}
        >
          <div className="w-full bg-white/20 h-0.5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-photoai-accent-cyan"
              initial={{ width: '0%' }}
              animate={{ 
                width: isCarouselPlaying && !isHovered && !reducedMotionPreference ? '100%' : '0%' 
              }}
              transition={{ 
                duration: reducedMotionPreference ? 0 : autoplayInterval / 1000,
                ease: 'linear',
                repeat: isCarouselPlaying && !isHovered && !reducedMotionPreference ? Infinity : 0
              }}
            />
          </div>
        </div>
      )}

      {/* Final status announcement for screen readers */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className={SCREEN_READER_ONLY_CLASS}
        id="carousel-status"
      >
        {videos.length > 0 && (
          <>
            Video carousel with {videos.length} slides. 
            Currently on slide {currentIndex + 1}: {videos[currentIndex]?.title || 'Video'}.
            Autoplay is {isCarouselPlaying ? 'playing' : 'paused'}.
            {reducedMotionPreference && ' Motion reduced per user preference.'}
            {isScreenReaderDetected && ' Screen reader detected - enhanced accessibility active.'}
          </>
        )}
      </div>
    </motion.div>
  );
} 