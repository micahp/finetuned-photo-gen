export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  backoffMs = 500
) {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (res.ok) return res
      // Retry only for server errors (5xx)
      if (res.status < 500 || attempt === retries - 1) {
        // Convert non-OK response into error to let caller handle
        throw new Error(`Request failed with status ${res.status}`)
      }
    } catch (err: any) {
      lastError = err
      if (attempt === retries - 1) break
    }
    // Exponential backoff
    await new Promise((resolve) => setTimeout(resolve, backoffMs * 2 ** attempt))
  }
  throw lastError ?? new Error('Request failed')
} 