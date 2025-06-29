'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface HeroCarouselProps {
  videos?: Array<{
    id: string;
    url: string;
    thumbnail: string;
    title?: string;
    poster?: string;
  }>;
  autoplayInterval?: number;
  className?: string;
  pauseOnHover?: boolean;
  enableAutoplay?: boolean;
}

export function HeroCarousel({ 
  videos = [], 
  autoplayInterval = 5000,
  className = '',
  pauseOnHover = true,
  enableAutoplay = true
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCarouselPlaying, setIsCarouselPlaying] = useState(enableAutoplay);
  const [isHovered, setIsHovered] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const carouselIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle video references
  const setVideoRef = (el: HTMLVideoElement | null, index: number) => {
    videoRefs.current[index] = el;
  };

  // Auto-advance carousel
  useEffect(() => {
    if (!isCarouselPlaying || videos.length <= 1 || (pauseOnHover && isHovered)) {
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
          // Play current video
          video.currentTime = 0; // Reset to beginning
          video.play().catch(console.error);
        } else {
          // Pause other videos
          video.pause();
        }
      }
    });
  }, [currentIndex]);

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

  // Handle video load and setup
  const handleVideoLoad = (video: HTMLVideoElement) => {
    // Ensure video is properly configured
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
  };

  // Handle manual navigation
  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const toggleCarouselPlayback = () => {
    setIsCarouselPlaying(!isCarouselPlaying);
  };

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
                autoPlay={index === currentIndex}
                muted
                playsInline
                loop
                poster={video.poster || video.thumbnail}
                onLoadedData={(e) => handleVideoLoad(e.currentTarget)}
                preload={index === currentIndex ? 'auto' : 'metadata'}
              >
                <source src={video.url} type="video/mp4" />
                <div className="w-full h-full bg-gradient-to-br from-photoai-accent-cyan/10 to-photoai-accent-purple/10 flex items-center justify-center">
                  <p className="text-white/80 text-sm">Video not supported</p>
                </div>
              </video>
              
              {/* Video overlay for better text readability */}
              <div className="absolute inset-0 bg-black/20" />
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

      {/* Loading indicator for current video */}
      {videos.length > 0 && (
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