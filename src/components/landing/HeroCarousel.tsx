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
  }>;
  autoplayInterval?: number;
  className?: string;
  pauseOnHover?: boolean;
  enableAutoplay?: boolean;
  enableAdaptiveQuality?: boolean;
  preloadStrategy?: 'auto' | 'metadata' | 'none';
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
  preloadStrategy = 'metadata'
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCarouselPlaying, setIsCarouselPlaying] = useState(enableAutoplay);
  const [isHovered, setIsHovered] = useState(false);
  const [loadedVideos, setLoadedVideos] = useState<Set<number>>(new Set());
  const [estimatedBandwidth, setEstimatedBandwidth] = useState<number>(0);
  const [videoQualityMap, setVideoQualityMap] = useState<Map<string, 'low' | 'medium' | 'high'>>(new Map());
  
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const carouselIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadStartTimes = useRef<Map<number, number>>(new Map());
  
  // Enhanced optimization utilities
  const bandwidthEstimator = useRef(new BandwidthEstimator());
  const errorHandler = useRef(new VideoErrorHandler());
  const accessibilityManager = useRef(new VideoAccessibilityManager());
  const performanceMonitor = useRef(new VideoPerformanceMonitor());
  
  const connectionQuality = useConnectionQuality();
  const deviceType = useDeviceType();

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

  // Preload adjacent videos intelligently
  const preloadAdjacentVideos = useCallback(() => {
    if (!enableAutoplay || videos.length <= 1) return;

    const nextIndex = (currentIndex + 1) % videos.length;
    const prevIndex = (currentIndex - 1 + videos.length) % videos.length;

    // Preload next video (higher priority)
    if (!loadedVideos.has(nextIndex)) {
      const nextVideo = videoRefs.current[nextIndex];
      const nextVideoData = videos[nextIndex];
      if (nextVideo && nextVideoData && nextVideo.readyState < 2) {
        loadVideoWithPlaceholder(nextVideoData, nextVideo);
      }
    }

    // Preload previous video if connection is good
    if (connectionQuality !== 'low' && !loadedVideos.has(prevIndex)) {
      const prevVideo = videoRefs.current[prevIndex];
      const prevVideoData = videos[prevIndex];
      if (prevVideo && prevVideoData && prevVideo.readyState < 2) {
        loadVideoWithPlaceholder(prevVideoData, prevVideo);
      }
    }
  }, [currentIndex, videos, loadedVideos, connectionQuality, enableAutoplay, loadVideoWithPlaceholder]);

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
    setCurrentIndex(index);
  };

  const toggleCarouselPlayback = () => {
    setIsCarouselPlaying(!isCarouselPlaying);
  };

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
      className={`relative w-full h-full overflow-hidden rounded-lg ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Container */}
      <div className="relative w-full h-full bg-photoai-dark">
        {videos.length > 0 ? (
          videos.map((video, index) => (
            <motion.div
              key={video.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: index === currentIndex ? 1 : 0 }}
              transition={{ duration: 0.5 }}
            >
              <video
                ref={(el) => setVideoRef(el, index)}
                className="w-full h-full object-cover"
                autoPlay={index === currentIndex && accessibilitySettings.autoplay}
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
                aria-label={video.title || `Hero video ${index + 1}`}
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

      {/* Navigation Dots */}
      {videos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {videos.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-photoai-accent-cyan shadow-lg shadow-photoai-accent-cyan/50' 
                  : 'bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Play/Pause Control */}
      <button
        onClick={toggleCarouselPlayback}
        className="absolute top-4 right-4 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
        aria-label={isCarouselPlaying ? 'Pause carousel' : 'Play carousel'}
      >
        {isCarouselPlaying ? (
          <div className="w-3 h-3 flex space-x-0.5">
            <div className="w-1 h-3 bg-white"></div>
            <div className="w-1 h-3 bg-white"></div>
          </div>
        ) : (
          <div className="w-0 h-0 border-l-3 border-l-white border-t-2 border-t-transparent border-b-2 border-b-transparent ml-0.5" />
        )}
      </button>

      {/* Performance indicator (dev mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 text-xs text-white/60 bg-black/50 p-2 rounded space-y-1">
          <div>Connection: {connectionQuality}</div>
          <div>Device: {deviceType}</div>
          <div>Loaded: {loadedVideos.size}/{videos.length}</div>
          <div>Bandwidth: {Math.round(estimatedBandwidth)}kbps</div>
          <div>Quality Score: {Math.round(performanceMonitor.current.getOverallQualityScore())}</div>
          <div>Reduced Motion: {accessibilitySettings.reduceAnimations ? 'Yes' : 'No'}</div>
        </div>
      )}

      {/* Loading progress bar */}
      {videos.length > 0 && accessibilitySettings.autoplay && (
        <div className="absolute bottom-1 left-4 right-4">
          <div className="w-full bg-white/20 h-0.5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-photoai-accent-cyan"
              initial={{ width: '0%' }}
              animate={{ 
                width: isCarouselPlaying && !isHovered ? '100%' : '0%' 
              }}
              transition={{ 
                duration: autoplayInterval / 1000,
                ease: 'linear',
                repeat: isCarouselPlaying && !isHovered ? Infinity : 0
              }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
} 