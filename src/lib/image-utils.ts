/**
 * Utility functions for handling image URLs and preventing CORS/ORB issues
 */

/**
 * Convert external image URLs to use our proxy to prevent ORB errors
 * UPDATE: This function now returns the original URL directly as the proxy is being removed.
 */
export function getProxiedImageUrl(imageUrl: string): string {
  return imageUrl;
}

/**
 * Get the original URL from a proxied URL
 */
export function getOriginalImageUrl(proxiedUrl: string): string {
  if (!proxiedUrl.includes('/api/image-proxy')) {
    return proxiedUrl
  }

  try {
    const url = new URL(proxiedUrl, window.location.origin)
    return url.searchParams.get('url') || proxiedUrl
  } catch {
    return proxiedUrl
  }
} 