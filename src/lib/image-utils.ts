/**
 * Utility functions for handling image URLs and preventing CORS/ORB issues
 */

/**
 * Check if a URL is external (not from our domain)
 */
export function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    // Check if it's a different domain than our app
    return !urlObj.hostname.includes('localhost') && 
           !urlObj.pathname.startsWith('/api/') &&
           !urlObj.pathname.startsWith('/uploads/')
  } catch {
    return false
  }
}

/**
 * Convert external image URLs to use our proxy to prevent ORB errors
 */
export function getProxiedImageUrl(imageUrl: string): string {
  // If it's already a local URL, return as-is
  if (!isExternalUrl(imageUrl)) {
    return imageUrl
  }

  // Use our image proxy for external URLs
  return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
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