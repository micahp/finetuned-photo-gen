'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import { VideoSource } from '@/lib/video-optimization';
import { Button } from '@/components/ui/button';

interface HeroCarouselProps {
  videos?: Array<{
    id: string;
    sources: VideoSource[];
    url?: string;
    thumbnail: string;
    title?: string;
    poster?: string;
    lowQualityPlaceholder?: string;
    description?: string;
    fullPrompt?: string;
    transcript?: string;
  }>;
  autoplayInterval?: number;
  className?: string;
  pauseOnHover?: boolean;
  enableAutoplay?: boolean;
  enableAdaptiveQuality?: boolean;
  preloadStrategy?: 'auto' | 'metadata' | 'none';
  ariaLabel?: string;
}

export function HeroCarousel({
  videos = [],
  autoplayInterval = 30000,
  className = '',
  pauseOnHover = true,
  enableAutoplay = true,
  enableAdaptiveQuality = true,
  preloadStrategy = 'metadata',
  ariaLabel = 'Hero video carousel'
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Clear interval helper
  const clearAutoplay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (!enableAutoplay || isPaused || videos.length <= 1) return;

    clearAutoplay();
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % videos.length);
    }, autoplayInterval);

    return clearAutoplay;
  }, [enableAutoplay, isPaused, videos.length, autoplayInterval, clearAutoplay]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCurrentIndex((prev) => (prev + 1) % videos.length);
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsPaused(prev => !prev);
    }
  }, [videos.length]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Navigate to specific slide
  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
  }, [videos.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  }, [videos.length]);

  // Pause/resume handlers
  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  // Video ref management
  const setVideoRef = useCallback((id: string, element: HTMLVideoElement | null) => {
    if (element) {
      videoRefs.current.set(id, element);
    } else {
      videoRefs.current.delete(id);
    }
  }, []);

  // Toggle prompt expansion
  const togglePromptExpansion = useCallback((videoId: string) => {
    setExpandedPrompts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  }, []);

  // Control video playback
  useEffect(() => {
    const currentVideo = videoRefs.current.get(videos[currentIndex]?.id);
    if (currentVideo) {
      if (isPlaying && !isPaused) {
        currentVideo.play().catch(error => {
          console.error(`Failed to play video ${videos[currentIndex]?.id}:`, error);
          // Optionally, stop trying to play if it consistently fails
          // setIsPlaying(false);
        });
      } else {
        currentVideo.pause();
      }
    }

    // Pause other videos
    videoRefs.current.forEach((video, id) => {
      if (id !== videos[currentIndex]?.id) {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [currentIndex, isPlaying, isPaused, videos]);

  if (videos.length === 0) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-2xl font-bold mb-4">No videos available</h2>
          <p className="text-gray-400">Please add some videos to display in the carousel.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full h-screen overflow-hidden bg-black ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Video Display */}
      <div className="relative w-full h-full">
        {/* Global Tagline */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none text-center px-4">
          <h1
            className="text-white font-bold drop-shadow-lg text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
            aria-label="Cast yourself in any movie"
          >
            Cast yourself in any movie.
          </h1>
        </div>

        {videos.map((video, index) => {
          const isActive = index === currentIndex;
          const videoSrc = video.sources?.[0]?.url || video.url || '';
          
          return (
            <div
              key={video.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <video
                ref={(el) => setVideoRef(video.id, el)}
                src={videoSrc}
                poster={video.poster || video.thumbnail}
                className="w-full h-full object-cover"
                preload={preloadStrategy}
                muted
                loop
                playsInline
                aria-label={video.description || video.title || `Video ${index + 1}`}
                onError={(e) => console.error(`Video error for ${video.id}:`, e.currentTarget.error)}
              />
              
              {/* Video Overlay with Title */}
              {video.title && (
                <div className="absolute bottom-20 left-8 right-8 z-20">
                  <div className="bg-black/50 backdrop-blur-sm rounded-lg px-6 py-4">
                    <h2 className="text-white text-2xl font-bold">{video.title}</h2>
                    {video.description && (
                      <div className="mt-2">
                        <p className="text-white/80">
                          {expandedPrompts.has(video.id) && video.fullPrompt 
                            ? video.fullPrompt 
                            : video.description
                          }
                        </p>
                        {video.fullPrompt && video.fullPrompt !== video.description && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePromptExpansion(video.id)}
                            className="mt-2 text-white/70 hover:text-white hover:bg-white/10 p-2 h-auto text-sm"
                          >
                            {expandedPrompts.has(video.id) ? (
                              <>
                                <ChevronUp className="w-4 h-4 mr-1" />
                                Hide full prompt
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 mr-1" />
                                See full prompt
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Controls */}
      {videos.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Previous video"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Next video"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Play/Pause Button */}
      <button
        onClick={() => setIsPlaying(prev => !prev)}
        className="absolute bottom-4 right-8 z-30 bg-black/30 hover:bg-black/50 text-white p-3 rounded-full transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
      >
        {isPlaying && !isPaused ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6" />
        )}
      </button>

      {/* Dots Navigation */}
      {videos.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex space-x-2">
          {videos.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                index === currentIndex
                  ? 'bg-white scale-125'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to video ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
} 