'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StickyHeaderProps {
  className?: string;
}

// Color contrast utilities for dynamic text color calculation
const colorUtils = {
  // Convert RGB to relative luminance for contrast calculation
  getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  // Calculate contrast ratio between two colors
  getContrastRatio(lum1: number, lum2: number): number {
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  },

  // Extract RGB values from computed style color
  parseColor(color: string): { r: number; g: number; b: number } | null {
    if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return null;
    }
    
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
    return null;
  },

  // Sample background color at header position
  sampleBackgroundColor(): { r: number; g: number; b: number } | null {
    try {
      // Check if we're in a browser environment with required APIs
      if (typeof window === 'undefined' || typeof document === 'undefined' || !document.elementFromPoint) {
        return null;
      }

      // Get elements behind the header area
      const headerHeight = 64; // 16 * 4px (h-16)
      const samplePoints = [
        { x: window.innerWidth * 0.2, y: headerHeight / 2 },
        { x: window.innerWidth * 0.5, y: headerHeight / 2 },
        { x: window.innerWidth * 0.8, y: headerHeight / 2 }
      ];

      const colors: { r: number; g: number; b: number }[] = [];

      for (const point of samplePoints) {
        const element = document.elementFromPoint(point.x, point.y);
        if (element && element.tagName !== 'HEADER') {
          const computedStyle = window.getComputedStyle(element);
          const bgColor = computedStyle.backgroundColor;
          const parsed = this.parseColor(bgColor);
          
          if (parsed) {
            colors.push(parsed);
          } else {
            // If transparent, look at parent elements
            let parent = element.parentElement;
            while (parent && colors.length === 0) {
              const parentStyle = window.getComputedStyle(parent);
              const parentBg = this.parseColor(parentStyle.backgroundColor);
              if (parentBg) {
                colors.push(parentBg);
                break;
              }
              parent = parent.parentElement;
            }
          }
        }
      }

      // Average the sampled colors
      if (colors.length > 0) {
        const avgColor = colors.reduce(
          (acc, color) => ({
            r: acc.r + color.r,
            g: acc.g + color.g,
            b: acc.b + color.b
          }),
          { r: 0, g: 0, b: 0 }
        );

        return {
          r: Math.round(avgColor.r / colors.length),
          g: Math.round(avgColor.g / colors.length),
          b: Math.round(avgColor.b / colors.length)
        };
      }
    } catch (error) {
      console.warn('Error sampling background color:', error);
    }

    return null;
  },

  // Determine optimal text color for given background
  getOptimalTextColor(backgroundColor: { r: number; g: number; b: number } | null): 'light' | 'dark' {
    if (!backgroundColor) {
      // Default to dark text for unknown backgrounds
      return 'dark';
    }

    const bgLuminance = this.getLuminance(backgroundColor.r, backgroundColor.g, backgroundColor.b);
    
    // Test contrast with white text (light theme)
    const whiteLuminance = 1;
    const whiteContrast = this.getContrastRatio(whiteLuminance, bgLuminance);
    
    // Test contrast with dark text
    const darkLuminance = this.getLuminance(10, 10, 10); // Very dark gray
    const darkContrast = this.getContrastRatio(darkLuminance, bgLuminance);
    
    // WCAG AA requires 4.5:1 contrast ratio for normal text
    const minContrast = 4.5;
    
    if (whiteContrast >= minContrast && darkContrast >= minContrast) {
      // Both work, choose based on background brightness
      return bgLuminance > 0.5 ? 'dark' : 'light';
    } else if (whiteContrast >= minContrast) {
      return 'light';
    } else if (darkContrast >= minContrast) {
      return 'dark';
    } else {
      // Neither meets contrast requirements, choose the better one
      return whiteContrast > darkContrast ? 'light' : 'dark';
    }
  }
};

export function StickyHeader({ className = '' }: StickyHeaderProps) {
  const { data: session, status } = useSession();
  const [scrollY, setScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [textColorMode, setTextColorMode] = useState<'light' | 'dark'>('dark');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastSampleTime = useRef(0);
  const sampleThrottle = 100; // Sample every 100ms max

  // Track scroll position and dynamic background sampling
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > 50);

      // Throttle background sampling for performance
      const now = Date.now();
      if (now - lastSampleTime.current > sampleThrottle) {
        lastSampleTime.current = now;
        
        // Sample background color and determine optimal text color
        const backgroundColor = colorUtils.sampleBackgroundColor();
        const optimalTextColor = colorUtils.getOptimalTextColor(backgroundColor);
        
        if (optimalTextColor !== textColorMode) {
          setIsTransitioning(true);
          setTextColorMode(optimalTextColor);
          
          // Reset transition state after animation completes
          setTimeout(() => setIsTransitioning(false), 300);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial sampling
    setTimeout(() => {
      const backgroundColor = colorUtils.sampleBackgroundColor();
      const optimalTextColor = colorUtils.getOptimalTextColor(backgroundColor);
      setTextColorMode(optimalTextColor);
    }, 100);

    return () => window.removeEventListener('scroll', handleScroll);
  }, [textColorMode]);

  // Close mobile menu on route change or escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Navigation configuration based on authentication status
  const isAuthenticated = status === 'authenticated' && session?.user;

  // Primary navigation - public pages
  const primaryNavigation = [
    { href: '/dashboard/gallery', label: 'Explore', description: 'Browse AI-generated images' },
    { href: '/dashboard/generate', label: 'Create', hasNew: true, description: 'Generate new images with AI' },
  ];

  // Secondary navigation - changes based on auth status
  const secondaryNavigation = isAuthenticated 
    ? [
        { href: '/dashboard', label: 'Dashboard', description: 'Your main dashboard' },
        { href: '/dashboard/generate', label: 'Generate', icon: Zap, description: 'Quick generate access' },
      ]
    : [
        { href: '/dashboard/billing', label: 'Pricing', description: 'View pricing plans' },
        { href: '/login', label: 'Login', description: 'Sign in to your account' },
      ];

  // Dynamic text color classes based on contrast analysis
  const getTextColorClasses = (opacity: string = '') => {
    const baseClasses = 'transition-colors duration-300';
    if (textColorMode === 'light') {
      return `${baseClasses} text-white${opacity ? `/${opacity}` : ''}`;
    } else {
      return `${baseClasses} text-photoai-dark${opacity ? `/${opacity}` : ''} dark:text-white${opacity ? `/${opacity}` : ''}`;
    }
  };

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-photoai-dark/90 backdrop-blur-md border-b border-white/10' 
            : 'bg-transparent'
        } ${className}`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo Section */}
            <Link 
              href={isAuthenticated ? "/dashboard" : "/"} 
              className="flex items-center space-x-3 group"
              aria-label="Fine Photo Gen - Home"
            >
              <div className="flex items-center space-x-2">
                <Image 
                  src="/favicon-transparent.png" 
                  alt="Fine Photo Gen Logo" 
                  width={32} 
                  height={32}
                  className="transition-transform group-hover:scale-110"
                />
                <div className="flex items-center space-x-2">
                  <span className={`font-bold text-lg ${getTextColorClasses()}`}>
                    Fine Photo Gen
                  </span>
                  <div className="neon-label text-[9px] font-normal px-1.5 py-0.5">
                    beta
                  </div>
                </div>
              </div>
            </Link>

            {/* Primary Navigation - Desktop */}
            <nav className="hidden md:flex items-center space-x-8" role="navigation" aria-label="Primary navigation">
              <div className="flex items-center space-x-6">
                {primaryNavigation.map((item) => (
                  <div key={item.href} className="flex items-center space-x-2">
                    <Link 
                      href={item.href} 
                      className={`font-medium transition-colors hover:text-photoai-accent-cyan focus:text-photoai-accent-cyan focus:outline-none ${getTextColorClasses()}`}
                      title={item.description}
                    >
                      {item.label}
                    </Link>
                    {item.hasNew && (
                      <div className="neon-label text-[10px] font-medium px-1.5 py-0.5 flex items-center space-x-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>New</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </nav>

            {/* Secondary Navigation & CTA - Desktop */}
            <div className="hidden md:flex items-center space-x-4">
              {secondaryNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium transition-colors hover:text-photoai-accent-cyan focus:text-photoai-accent-cyan focus:outline-none flex items-center space-x-1 ${getTextColorClasses('60')}`}
                    title={item.description}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* CTA Button */}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  asChild
                  className="bg-photoai-gradient text-white px-4 py-2 rounded-lg font-medium text-sm photoai-hover-glow border-0"
                >
                  <Link href={isAuthenticated ? "/dashboard/generate" : "/register"}>
                    {isAuthenticated ? "Generate" : "Start Free"}
                  </Link>
                </Button>
              </motion.div>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 rounded-lg transition-colors hover:bg-white/10 focus:bg-white/10 focus:outline-none"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMobileMenuOpen ? (
                <X className={`w-6 h-6 ${getTextColorClasses()}`} />
              ) : (
                <Menu className={`w-6 h-6 ${getTextColorClasses()}`} />
              )}
            </button>
          </div>
        </div>

        {/* Scroll Progress Indicator */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-photoai-accent-cyan"
          style={{
            width: typeof window !== 'undefined' 
              ? `${Math.min((scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100, 100)}%`
              : '0%'
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
        />
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Mobile Menu Panel */}
            <motion.div
              id="mobile-menu"
              className="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] bg-photoai-dark/95 backdrop-blur-md border-l border-white/10 z-50 md:hidden"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              role="navigation"
              aria-label="Mobile navigation"
            >
              <div className="p-6 space-y-6">
                {/* User Status Section */}
                {isAuthenticated && session?.user && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-photoai-gradient rounded-full flex items-center justify-center text-white font-semibold">
                        {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        {session.user.name && (
                          <p className="font-medium text-white truncate">{session.user.name}</p>
                        )}
                        <p className="text-sm text-white/60 truncate">{session.user.email}</p>
                        <p className="text-sm text-photoai-accent-cyan">
                          {session.user.credits || 0} credits
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Navigation */}
                <div>
                  <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-3">
                    Navigation
                  </h3>
                  <div className="space-y-2">
                    {primaryNavigation.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center justify-between p-3 rounded-lg text-white hover:bg-white/10 transition-colors focus:bg-white/10 focus:outline-none"
                        onClick={() => setIsMobileMenuOpen(false)}
                        title={item.description}
                      >
                        <span className="font-medium">{item.label}</span>
                        {item.hasNew && (
                          <div className="neon-label text-[10px] font-medium px-1.5 py-0.5 flex items-center space-x-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>New</span>
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Secondary Navigation */}
                <div>
                  <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-3">
                    {isAuthenticated ? 'Quick Access' : 'Account'}
                  </h3>
                  <div className="space-y-2">
                    {secondaryNavigation.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center space-x-3 p-3 rounded-lg text-white hover:bg-white/10 transition-colors focus:bg-white/10 focus:outline-none"
                          onClick={() => setIsMobileMenuOpen(false)}
                          title={item.description}
                        >
                          {Icon && <Icon className="w-5 h-5" />}
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-4 border-t border-white/10">
                  <Button
                    asChild
                    className="w-full bg-photoai-gradient text-white py-3 px-6 rounded-lg font-medium photoai-hover-glow border-0"
                  >
                    <Link 
                      href={isAuthenticated ? "/dashboard/generate" : "/register"}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {isAuthenticated ? "Generate" : "Start Free"}
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
} 