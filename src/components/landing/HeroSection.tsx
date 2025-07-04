'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { HeroCarousel } from './HeroCarousel';
import { useState, useEffect } from 'react';
import { generateDemoVideos, OptimizedVideo, createVideoPreloadLinks } from '@/lib/video-optimization';
import { isTouchDevice, getDeviceOrientation } from '@/lib/touch-utils';

interface HeroSectionProps {
  videos?: OptimizedVideo[];
  className?: string;
}

export function HeroSection({ videos, className = '' }: HeroSectionProps) {
  const [userCount, setUserCount] = useState(0);
  const [optimizedVideos, setOptimizedVideos] = useState<OptimizedVideo[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [deviceOrientation, setDeviceOrientation] = useState<'portrait' | 'landscape'>('landscape');

  // Initialize mobile detection
  useEffect(() => {
    setIsMobile(isTouchDevice());
    setDeviceOrientation(getDeviceOrientation());
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setDeviceOrientation(getDeviceOrientation());
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Initialize optimized demo videos
  useEffect(() => {
    const demoVideos = videos || generateDemoVideos();
    setOptimizedVideos(demoVideos);
  }, [videos]);

  // Animate user count on component mount
  useEffect(() => {
    const targetCount = 1247; // Replace with actual user count
    const duration = 2000; // 2 seconds
    const increment = targetCount / (duration / 50);
    
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetCount) {
        setUserCount(targetCount);
        clearInterval(timer);
      } else {
        setUserCount(Math.floor(current));
      }
    }, 50);

    return () => clearInterval(timer);
  }, []);

  return (
    <section 
      className={`relative ${
        isMobile && deviceOrientation === 'landscape' ? 'min-h-[100dvh]' : 'min-h-screen'
      } flex items-center justify-center overflow-hidden ${className}`}
      aria-label="Hero section"
      role="banner"
    >
      {/* Video preload optimization */}
      {optimizedVideos.length > 0 && (
        <div 
          dangerouslySetInnerHTML={{ 
            __html: createVideoPreloadLinks(optimizedVideos, 2) 
          }} 
        />
      )}

      {/* Background Video Carousel */}
      <div className="absolute inset-0 z-0">
        <HeroCarousel 
          videos={optimizedVideos}
          autoplayInterval={6000}
          pauseOnHover={false}
          enableAdaptiveQuality={true}
          preloadStrategy="metadata"
          ariaLabel="Hero section background videos showcasing AI-generated photos"
          className="w-full h-full"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Hero Content */}
      <div className={`relative z-10 max-w-4xl mx-auto ${
        isMobile ? 'px-4 py-8' : 'px-4 sm:px-6 lg:px-8'
      } text-center ${
        isMobile && deviceOrientation === 'landscape' ? 'py-4' : ''
      }`}>
                  <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className={isMobile && deviceOrientation === 'landscape' ? 'space-y-4' : 'space-y-8'}
          >
          {/* Social Proof Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex justify-center"
          >
            <Badge variant="secondary" className="bg-white/10 text-white border-white/20 px-4 py-2 text-sm backdrop-blur-sm">
              <span className="mr-2">🎨</span>
              Used by {userCount.toLocaleString()}+ creators
            </Badge>
          </motion.div>

          {/* Main Tagline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className={`font-bold text-white leading-tight ${
              isMobile && deviceOrientation === 'landscape' 
                ? 'text-2xl sm:text-3xl' 
                : 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'
            }`}
          >
            Create Stunning{' '}
            <span className="bg-gradient-to-r from-fine-accent-cyan to-fine-accent-purple bg-clip-text text-transparent">
              AI Photos
            </span>
            <br />
            of Yourself
          </motion.h1>

          {/* Secondary Tagline */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className={`font-semibold text-fine-accent-cyan ${
              isMobile && deviceOrientation === 'landscape'
                ? 'text-lg'
                : 'text-xl sm:text-2xl md:text-3xl'
            }`}
          >
            Cast yourself in any movie.
          </motion.h2>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className={`text-white/90 max-w-2xl mx-auto leading-relaxed ${
              isMobile && deviceOrientation === 'landscape' 
                ? 'text-sm' 
                : 'text-base sm:text-lg md:text-xl'
            }`}
          >
            Upload your photos, train a custom AI model, and generate unlimited 
            personalized images in any style or setting you can imagine.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className={`flex ${
              isMobile && deviceOrientation === 'landscape' 
                ? 'flex-row gap-3' 
                : 'flex-col sm:flex-row gap-4'
            } justify-center items-center`}
          >
            <Button 
              asChild 
              size={isMobile && deviceOrientation === 'landscape' ? "default" : "lg"}
              className={`bg-fine-accent-cyan hover:bg-fine-accent-cyan/90 text-black font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-fine-accent-cyan/25 ${
                isMobile && deviceOrientation === 'landscape' 
                  ? 'px-6 py-2 text-base min-h-[44px] min-w-[120px]' 
                  : 'px-8 py-3 text-lg'
              }`}
            >
              <Link href="/register">
                Start Free
              </Link>
            </Button>
            
            <Button 
              asChild 
              variant="outline" 
              size={isMobile && deviceOrientation === 'landscape' ? "default" : "lg"}
              className={`border-white/30 text-white hover:bg-white/10 font-semibold backdrop-blur-sm transition-all duration-300 hover:scale-105 ${
                isMobile && deviceOrientation === 'landscape' 
                  ? 'px-6 py-2 text-base min-h-[44px] min-w-[120px]' 
                  : 'px-8 py-3 text-lg'
              }`}
            >
              <Link href="/dashboard/gallery">
                See Examples
              </Link>
            </Button>
          </motion.div>

          {/* Additional Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 text-white/70 text-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>No subscription required</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-white/30 rounded-full"></div>
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <span>Results in minutes</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-white/30 rounded-full"></div>
            <div className="flex items-center gap-2">
              <span>🔒</span>
              <span>Your photos stay private</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator - Hidden on mobile landscape */}
      {!(isMobile && deviceOrientation === 'landscape') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className={`absolute ${
            isMobile ? 'bottom-4' : 'bottom-8'
          } left-1/2 transform -translate-x-1/2`}
        >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2 text-white/60"
        >
          <span className="text-sm">Scroll to explore</span>
          <div className="w-6 h-10 border border-white/30 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-3 bg-white/60 rounded-full mt-2"
            />
          </div>
        </motion.div>
        </motion.div>
      )}
    </section>
  );
} 