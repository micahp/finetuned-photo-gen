'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { HeroCarousel } from './HeroCarousel';
import { useState, useEffect } from 'react';

interface HeroSectionProps {
  videos?: Array<{
    id: string;
    url: string;
    thumbnail: string;
    title?: string;
    poster?: string;
  }>;
  className?: string;
}

// Mock data for demonstration - replace with actual video content
const defaultVideos = [
  {
    id: 'video1',
    url: '/api/placeholder-video', // This will need to be replaced with actual video URLs
    thumbnail: '/placeholder-thumbnail-1.jpg',
    poster: '/placeholder-poster-1.jpg',
    title: 'AI Portrait Generation'
  },
  {
    id: 'video2', 
    url: '/api/placeholder-video',
    thumbnail: '/placeholder-thumbnail-2.jpg',
    poster: '/placeholder-poster-2.jpg',
    title: 'Custom Style Training'
  },
  {
    id: 'video3',
    url: '/api/placeholder-video', 
    thumbnail: '/placeholder-thumbnail-3.jpg',
    poster: '/placeholder-poster-3.jpg',
    title: 'Professional Results'
  }
];

export function HeroSection({ videos = defaultVideos, className = '' }: HeroSectionProps) {
  const [userCount, setUserCount] = useState(0);

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
    <div className={`relative min-h-screen flex items-center justify-center overflow-hidden ${className}`}>
      {/* Background Video Carousel */}
      <div className="absolute inset-0 z-0">
        <HeroCarousel 
          videos={videos}
          autoplayInterval={6000}
          pauseOnHover={false}
          className="w-full h-full"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8"
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
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight"
          >
            Create Stunning{' '}
            <span className="bg-gradient-to-r from-photoai-accent-cyan to-photoai-accent-purple bg-clip-text text-transparent">
              AI Photos
            </span>
            <br />
            of Yourself
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed"
          >
            Upload your photos, train a custom AI model, and generate unlimited 
            personalized images in any style or setting you can imagine.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button 
              asChild 
              size="lg" 
              className="bg-photoai-accent-cyan hover:bg-photoai-accent-cyan/90 text-black font-semibold px-8 py-3 text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-photoai-accent-cyan/25"
            >
              <Link href="/register">
                Start Free
              </Link>
            </Button>
            
            <Button 
              asChild 
              variant="outline" 
              size="lg"
              className="border-white/30 text-white hover:bg-white/10 font-semibold px-8 py-3 text-lg backdrop-blur-sm transition-all duration-300 hover:scale-105"
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

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
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
    </div>
  );
} 