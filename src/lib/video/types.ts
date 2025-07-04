/**
 * Core video types for video optimization modules
 */

/**
 * Represents a single video source with quality and format information
 */
export interface VideoSource {
  url: string;
  type: string;
  resolution?: string;
  quality?: 'low' | 'medium' | 'high';
  bandwidth?: number; // kbps
}

/**
 * Represents a video with multiple quality sources and metadata
 */
export interface OptimizedVideo {
  id: string;
  sources: VideoSource[];
  thumbnail: string;
  poster?: string;
  title?: string;
  duration?: number;
  lowQualityPlaceholder?: string; // Ultra-low quality placeholder for instant loading
} 