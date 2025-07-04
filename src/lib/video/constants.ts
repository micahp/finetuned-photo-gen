/**
 * Constants for video optimization
 */

/**
 * Video format configurations for different quality levels
 */
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

/**
 * Supported video formats for cross-browser compatibility
 */
export const VIDEO_FORMATS = {
  mp4: 'video/mp4; codecs="avc1.42E01E"',
  webm: 'video/webm; codecs="vp9"',
  av1: 'video/mp4; codecs="av01.0.05M.08"'
} as const; 