'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface HeroCarouselProps {
  videos?: Array<{
    id: string;
    url: string;
    thumbnail: string;
    title?: string;
  }>;
  autoplayInterval?: number;
  className?: string;
}

export function HeroCarousel({ 
  videos = [], 
  autoplayInterval = 5000,
  className = '' 
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Auto-advance carousel
  useEffect(() => {
    if (!isPlaying || videos.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % videos.length);
    }, autoplayInterval);

    return () => clearInterval(interval);
  }, [isPlaying, videos.length, autoplayInterval]);

  return (
    <motion.div
      className={`relative w-full h-full overflow-hidden rounded-lg ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
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
              {/* Placeholder for video element */}
              <div className="w-full h-full bg-gradient-to-br from-photoai-accent-cyan/10 to-photoai-accent-purple/10 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-l-8 border-l-white border-t-4 border-t-transparent border-b-4 border-b-transparent ml-1" />
                  </div>
                  <p className="text-white/80 text-sm">Video: {video.title || video.id}</p>
                </div>
              </div>
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
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-photoai-accent-cyan shadow-lg shadow-photoai-accent-cyan/50' 
                  : 'bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* Play/Pause Control */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="absolute top-4 right-4 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
      >
        {isPlaying ? (
          <div className="w-3 h-3 flex space-x-0.5">
            <div className="w-1 h-3 bg-white"></div>
            <div className="w-1 h-3 bg-white"></div>
          </div>
        ) : (
          <div className="w-0 h-0 border-l-3 border-l-white border-t-2 border-t-transparent border-b-2 border-b-transparent ml-0.5" />
        )}
      </button>
    </motion.div>
  );
} 