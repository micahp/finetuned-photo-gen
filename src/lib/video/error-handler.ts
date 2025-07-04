/**
 * Error handling and retry mechanisms for video playback
 */

import { VideoSource } from './types';

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