export function logOnce(key: string, logFn: () => void) {
  // Simple in-memory store to track which messages have already been printed
  const cache = (globalThis as any).__logOnceCache || new Set<string>()
  // Store the cache back to global to persist across HMR in Next.js dev
  ;(globalThis as any).__logOnceCache = cache

  if (cache.has(key)) return
  cache.add(key)
  // Only run the callback when not in production OR when explicitly allowed
  logFn()
} 