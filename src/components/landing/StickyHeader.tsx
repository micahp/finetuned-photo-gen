'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StickyHeaderProps {
  className?: string;
  isAuthenticated?: boolean;
}

export function StickyHeader({ className = '', isAuthenticated = false }: StickyHeaderProps) {
  const [scrollY, setScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  // Track scroll position for dynamic styling
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-photoai-dark/90 backdrop-blur-md border-b border-white/10' 
          : 'bg-transparent'
      } ${className}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-photoai-gradient rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className={`font-bold text-lg transition-colors ${
              isScrolled ? 'text-white' : 'text-photoai-dark dark:text-white'
            }`}>
              PhotoAI
            </span>
          </Link>

          {/* Primary Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <div className="flex items-center space-x-6">
              <Link 
                href="/explore" 
                className={`font-medium transition-colors hover:text-photoai-accent-cyan ${
                  isScrolled ? 'text-white' : 'text-photoai-dark dark:text-white'
                }`}
              >
                Explore
              </Link>
              <div className="flex items-center space-x-2">
                <Link 
                  href="/create" 
                  className={`font-medium transition-colors hover:text-photoai-accent-cyan ${
                    isScrolled ? 'text-white' : 'text-photoai-dark dark:text-white'
                  }`}
                >
                  Create
                </Link>
                <div className="neon-label text-xs">New</div>
              </div>
            </div>
          </nav>

          {/* Secondary Navigation */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard/canvas"
                  className={`text-sm font-medium transition-colors hover:text-photoai-accent-cyan ${
                    isScrolled ? 'text-white/80' : 'text-photoai-text-muted'
                  }`}
                >
                  Canvas
                </Link>
                <Link
                  href="/dashboard"
                  className={`text-sm font-medium transition-colors hover:text-photoai-accent-cyan ${
                    isScrolled ? 'text-white/80' : 'text-photoai-text-muted'
                  }`}
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/pricing"
                  className={`text-sm font-medium transition-colors hover:text-photoai-accent-cyan ${
                    isScrolled ? 'text-white/60' : 'text-photoai-text-muted'
                  }`}
                >
                  Pricing
                </Link>
                <Link
                  href="/login"
                  className={`text-sm font-medium transition-colors hover:text-photoai-accent-cyan ${
                    isScrolled ? 'text-white/60' : 'text-photoai-text-muted'
                  }`}
                >
                  Login
                </Link>
              </>
            )}

            {/* CTA Button */}
            <motion.button
              className="bg-photoai-gradient text-white px-4 py-2 rounded-lg font-medium text-sm photoai-hover-glow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Free
            </motion.button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2">
            <div className={`w-6 h-0.5 mb-1 transition-colors ${
              isScrolled ? 'bg-white' : 'bg-photoai-dark dark:bg-white'
            }`}></div>
            <div className={`w-6 h-0.5 mb-1 transition-colors ${
              isScrolled ? 'bg-white' : 'bg-photoai-dark dark:bg-white'
            }`}></div>
            <div className={`w-6 h-0.5 transition-colors ${
              isScrolled ? 'bg-white' : 'bg-photoai-dark dark:bg-white'
            }`}></div>
          </button>
        </div>
      </div>

      {/* Scroll Progress Indicator */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-photoai-accent-cyan"
        style={{
          width: `${Math.min((scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100, 100)}%`
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.3 }}
      />
    </motion.header>
  );
} 