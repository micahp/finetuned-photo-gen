// Video optimization utilities for enhanced performance
export interface VideoSource {
  url: string;
  type: string;
  resolution?: string;
  quality?: 'low' | 'medium' | 'high';
  bandwidth?: number; // kbps
}

export interface OptimizedVideo {
  id: string;
  sources: VideoSource[];
  thumbnail: string;
  poster?: string;
  title?: string;
  duration?: number;
  lowQualityPlaceholder?: string; // Ultra-low quality placeholder for instant loading
}

// Video format configurations for different quality levels
export const VIDEO_QUALITY_CONFIGS = {
  placeholder: {
    resolution: '240p',
    bandwidth: 200, // Very low bandwidth for instant loading
    fps: 15,
    codec: 'h264'
  },
  low: {
    resolution: '480p',
    bandwidth: 800, // kbps
    fps: 24,
    codec: 'h264'
  },
  medium: {
    resolution: '720p', 
    bandwidth: 1500, // kbps
    fps: 30,
    codec: 'h264'
  },
  high: {
    resolution: '1080p',
    bandwidth: 3000, // kbps
    fps: 30,
    codec: 'h264'
  }
} as const;

// Supported video formats for cross-browser compatibility
export const VIDEO_FORMATS = {
  mp4: 'video/mp4; codecs="avc1.42E01E"',
  webm: 'video/webm; codecs="vp9"',
  av1: 'video/mp4; codecs="av01.0.05M.08"'
} as const;

/**
 * Enhanced bandwidth detection with multiple measurement methods
 */
export class BandwidthEstimator {
  private measurements: number[] = [];
  private lastEstimate: number = 0;
  private isEstimating: boolean = false;

  async estimateBandwidth(): Promise<number> {
    if (this.isEstimating) return this.lastEstimate;
    
    this.isEstimating = true;
    
    try {
      // Method 1: Use navigator.connection if available
      const connectionEstimate = this.getConnectionEstimate();
      if (connectionEstimate > 0) {
        this.measurements.push(connectionEstimate);
      }

      // Method 2: Download test with small video chunk
      const downloadEstimate = await this.measureDownloadSpeed();
      if (downloadEstimate > 0) {
        this.measurements.push(downloadEstimate);
      }

      // Calculate weighted average (prefer recent measurements)
      if (this.measurements.length > 0) {
        const weights = this.measurements.map((_, i) => Math.pow(0.8, this.measurements.length - 1 - i));
        const weightedSum = this.measurements.reduce((sum, val, i) => sum + val * weights[i], 0);
        const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
        this.lastEstimate = weightedSum / weightSum;
      }

      return this.lastEstimate;
    } finally {
      this.isEstimating = false;
    }
  }

  private getConnectionEstimate(): number {
    // @ts-ignore - navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (!connection) return 0;

    // Convert connection type to estimated bandwidth (kbps)
    const typeMap: Record<string, number> = {
      'slow-2g': 250,
      '2g': 500,
      '3g': 1500,
      '4g': 3000,
      'wifi': 5000
    };

    return typeMap[connection.effectiveType] || 0;
  }

  private async measureDownloadSpeed(): Promise<number> {
    const testSize = 50000; // 50KB test file
    const timeout = 3000; // 3 second timeout
    
    try {
      const startTime = performance.now();
      
      // Create a small test request
      const response = await Promise.race([
        fetch('/api/health', { cache: 'no-cache' }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000; // seconds
      const bytes = testSize;
      const bitsPerSecond = (bytes * 8) / duration;
      const kbps = bitsPerSecond / 1000;

      return kbps;
    } catch (error) {
      console.warn('Bandwidth measurement failed:', error);
      return 0;
    }
  }

  getLastEstimate(): number {
    return this.lastEstimate;
  }
}

/**
 * Enhanced error handling and retry mechanism
 */
export class VideoErrorHandler {
  private retryCount: Map<string, number> = new Map();
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  async handleVideoError(
    videoElement: HTMLVideoElement,
    videoId: string,
    sources: VideoSource[]
  ): Promise<boolean> {
    const currentRetries = this.retryCount.get(videoId) || 0;
    
    if (currentRetries >= this.maxRetries) {
      console.error(`Video ${videoId} failed after ${this.maxRetries} retries`);
      return false;
    }

    this.retryCount.set(videoId, currentRetries + 1);

    // Wait before retry with exponential backoff
    const delay = this.retryDelay * Math.pow(2, currentRetries);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Try a lower quality source if available
      const currentSrcIndex = sources.findIndex(s => s.url === videoElement.currentSrc);
      const nextSource = sources[currentSrcIndex + 1];

      if (nextSource) {
        console.log(`Retrying ${videoId} with lower quality: ${nextSource.quality}`);
        videoElement.src = nextSource.url;
        videoElement.load();
        return true;
      } else {
        // Reload the current source
        console.log(`Retrying ${videoId} with same source`);
        videoElement.load();
        return true;
      }
    } catch (error) {
      console.error(`Retry failed for ${videoId}:`, error);
      return false;
    }
  }

  reset(videoId: string) {
    this.retryCount.delete(videoId);
  }
}

/**
 * Accessibility and reduced motion utilities
 */
export class VideoAccessibilityManager {
  private prefersReducedMotion: boolean;

  constructor() {
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Listen for changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
    });
  }

  shouldAutoplay(): boolean {
    return !this.prefersReducedMotion;
  }

  getOptimalSettings() {
    return {
      autoplay: this.shouldAutoplay(),
      reduceAnimations: this.prefersReducedMotion,
      showControls: this.prefersReducedMotion // Show controls if motion is reduced
    };
  }
}

/**
 * Generate multiple video sources for adaptive streaming with placeholder
 */
export function generateVideoSources(
  baseUrl: string,
  videoId: string,
  options: {
    includeWebM?: boolean;
    includeAV1?: boolean;
    includePlaceholder?: boolean;
    qualities?: Array<'low' | 'medium' | 'high'>;
  } = {}
): VideoSource[] {
  const { includeWebM = true, includeAV1 = false, includePlaceholder = true, qualities = ['medium', 'high'] } = options;
  const sources: VideoSource[] = [];

  // Add ultra-low quality placeholder first for instant loading
  if (includePlaceholder) {
    const placeholderConfig = VIDEO_QUALITY_CONFIGS.placeholder;
    sources.push({
      url: `${baseUrl}/${videoId}_${placeholderConfig.resolution}_placeholder.mp4`,
      type: VIDEO_FORMATS.mp4,
      resolution: placeholderConfig.resolution,
      quality: 'low',
      bandwidth: placeholderConfig.bandwidth
    });
  }

  // Generate sources for each quality level
  qualities.forEach(quality => {
    const config = VIDEO_QUALITY_CONFIGS[quality];
    
    // MP4 (H.264) - Universal compatibility
    sources.push({
      url: `${baseUrl}/${videoId}_${config.resolution}.mp4`,
      type: VIDEO_FORMATS.mp4,
      resolution: config.resolution,
      quality,
      bandwidth: config.bandwidth
    });

    // WebM (VP9) - Better compression for Chrome/Firefox
    if (includeWebM) {
      sources.push({
        url: `${baseUrl}/${videoId}_${config.resolution}.webm`,
        type: VIDEO_FORMATS.webm,
        resolution: config.resolution,
        quality,
        bandwidth: Math.round(config.bandwidth * 0.8) // WebM typically 20% smaller
      });
    }

    // AV1 - Future-proof format with best compression
    if (includeAV1) {
      sources.push({
        url: `${baseUrl}/${videoId}_${config.resolution}_av1.mp4`,
        type: VIDEO_FORMATS.av1,
        resolution: config.resolution,
        quality,
        bandwidth: Math.round(config.bandwidth * 0.7) // AV1 typically 30% smaller
      });
    }
  });

  // Sort by quality (low to high) and format preference
  return sources.sort((a, b) => {
    const qualityOrder = { low: 0, medium: 1, high: 2 };
    if (a.quality !== b.quality) {
      return qualityOrder[a.quality!] - qualityOrder[b.quality!];
    }
    
    // Prefer modern formats for same quality
    const formatOrder = { 'video/mp4': 0, 'video/webm': 1, 'video/av1': 2 };
    const aFormat = a.type.includes('av01') ? 'video/av1' : 
                   a.type.includes('webm') ? 'video/webm' : 'video/mp4';
    const bFormat = b.type.includes('av01') ? 'video/av1' : 
                   b.type.includes('webm') ? 'video/webm' : 'video/mp4';
    
    return formatOrder[aFormat] - formatOrder[bFormat];
  });
}

/**
 * Create preload link elements for video optimization
 */
export function createVideoPreloadLinks(videos: OptimizedVideo[], preloadCount: number = 2): string {
  const links: string[] = [];
  
  videos.slice(0, preloadCount).forEach(video => {
    // Preload the best quality source for each video
    const bestSource = video.sources.find(s => s.quality === 'medium') || video.sources[0];
    if (bestSource) {
      links.push(`<link rel="preload" href="${bestSource.url}" as="video" type="${bestSource.type}">`);
    }
    
    // Preload poster image
    if (video.poster) {
      links.push(`<link rel="preload" href="${video.poster}" as="image">`);
    }
  });
  
  return links.join('\n');
}

/**
 * Check browser support for video formats
 */
export function checkVideoFormatSupport(): {
  mp4: boolean;
  webm: boolean;
  av1: boolean;
} {
  const video = document.createElement('video');
  
  return {
    mp4: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
    webm: video.canPlayType('video/webm; codecs="vp9"') !== '',
    av1: video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== ''
  };
}

/**
 * Estimate bandwidth and suggest optimal quality with enhanced logic
 */
export function getOptimalQuality(
  estimatedBandwidth?: number,
  connectionType?: string,
  deviceType?: 'mobile' | 'tablet' | 'desktop'
): 'low' | 'medium' | 'high' {
  if (!estimatedBandwidth) return 'medium';
  
  // Adjust thresholds based on device type
  const deviceMultiplier = deviceType === 'mobile' ? 0.7 : deviceType === 'tablet' ? 0.85 : 1.0;
  const adjustedBandwidth = estimatedBandwidth * deviceMultiplier;
  
  if (adjustedBandwidth < 1000) return 'low';
  if (adjustedBandwidth < 2500) return 'medium';
  return 'high';
}

/**
 * Generate demo video data with optimized sources and placeholders
 */
export function generateDemoVideos(baseUrl: string = '/videos'): OptimizedVideo[] {
  const demoVideoIds = [
    { id: 'hero-demo-1', title: 'AI Portrait Generation' },
    { id: 'hero-demo-2', title: 'Custom Style Training' },
    { id: 'hero-demo-3', title: 'Professional Results' }
  ];

  return demoVideoIds.map(({ id, title }) => ({
    id,
    title,
    thumbnail: `${baseUrl}/thumbnails/${id}_thumb.jpg`,
    poster: `${baseUrl}/posters/${id}_poster.jpg`,
    lowQualityPlaceholder: `${baseUrl}/${id}_240p_placeholder.mp4`,
    sources: generateVideoSources(baseUrl, id, {
      includeWebM: true,
      includeAV1: false, // Disable AV1 for now due to limited support
      includePlaceholder: true,
      qualities: ['low', 'medium', 'high']
    })
  }));
}

/**
 * Enhanced performance monitoring for video loading
 */
export class VideoPerformanceMonitor {
  private metrics: Map<string, {
    loadStart: number;
    loadEnd?: number;
    bufferingEvents: number;
    errors: number;
    qualitySwitches: number;
    stallDuration: number;
  }> = new Map();

  startLoading(videoId: string) {
    this.metrics.set(videoId, {
      loadStart: performance.now(),
      bufferingEvents: 0,
      errors: 0,
      qualitySwitches: 0,
      stallDuration: 0
    });
  }

  endLoading(videoId: string) {
    const metric = this.metrics.get(videoId);
    if (metric) {
      metric.loadEnd = performance.now();
    }
  }

  recordBuffering(videoId: string, duration: number = 0) {
    const metric = this.metrics.get(videoId);
    if (metric) {
      metric.bufferingEvents++;
      metric.stallDuration += duration;
    }
  }

  recordError(videoId: string) {
    const metric = this.metrics.get(videoId);
    if (metric) {
      metric.errors++;
    }
  }

  recordQualitySwitch(videoId: string) {
    const metric = this.metrics.get(videoId);
    if (metric) {
      metric.qualitySwitches++;
    }
  }

  getMetrics(videoId: string) {
    const metric = this.metrics.get(videoId);
    if (!metric) return null;

    return {
      loadTime: metric.loadEnd ? metric.loadEnd - metric.loadStart : null,
      bufferingEvents: metric.bufferingEvents,
      errors: metric.errors,
      qualitySwitches: metric.qualitySwitches,
      stallDuration: metric.stallDuration,
      qualityScore: this.calculateQualityScore(metric)
    };
  }

  private calculateQualityScore(metric: any): number {
    // Calculate a quality score from 0-100 based on various factors
    let score = 100;
    
    // Penalize for errors
    score -= metric.errors * 20;
    
    // Penalize for excessive buffering
    if (metric.bufferingEvents > 2) {
      score -= (metric.bufferingEvents - 2) * 10;
    }
    
    // Penalize for stall duration
    if (metric.stallDuration > 1000) {
      score -= Math.min(metric.stallDuration / 1000 * 5, 30);
    }
    
    // Slight penalty for quality switches (indicates unstable connection)
    score -= metric.qualitySwitches * 2;
    
    return Math.max(0, Math.min(100, score));
  }

  getAllMetrics() {
    const allMetrics: Record<string, any> = {};
    
    this.metrics.forEach((metric, videoId) => {
      allMetrics[videoId] = {
        loadTime: metric.loadEnd ? metric.loadEnd - metric.loadStart : null,
        bufferingEvents: metric.bufferingEvents,
        errors: metric.errors,
        qualitySwitches: metric.qualitySwitches,
        stallDuration: metric.stallDuration,
        qualityScore: this.calculateQualityScore(metric)
      };
    });

    return allMetrics;
  }

  getAverageLoadTime(): number {
    const loadTimes = Array.from(this.metrics.values())
      .map(m => m.loadEnd ? m.loadEnd - m.loadStart : null)
      .filter((time): time is number => time !== null);

    if (loadTimes.length === 0) return 0;
    return loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
  }

  getOverallQualityScore(): number {
    const scores = Array.from(this.metrics.values())
      .map(m => this.calculateQualityScore(m));

    if (scores.length === 0) return 100;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
} 