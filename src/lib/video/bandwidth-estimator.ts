/**
 * Enhanced bandwidth detection for video streaming
 * This module is designed to be lazy-loaded when needed
 */

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