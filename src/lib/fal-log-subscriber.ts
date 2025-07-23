/**
 * Client-side helper that connects to our backend SSE proxy for Fal job logs.
 *
 * @returns cleanup function to close the stream.
 */
export function subscribeFalJob(
  modelId: string,
  requestId: string,
  onProgress: (pct: number) => void,
  onDone: (videoUrl: string) => void,
  onError?: (err: unknown) => void,
) {
  let maxProgress = 0
  const url = `/api/fal/stream?modelId=${encodeURIComponent(modelId)}&requestId=${requestId}`
  const es = new EventSource(url)

  es.onmessage = (ev) => {
    try {
      const msg: any = JSON.parse(ev.data)
      if (msg.type === 'progress') {
        if (msg.pct > maxProgress) {
          maxProgress = msg.pct
          onProgress(maxProgress)
        }
      } else if (msg.type === 'done') {
        onProgress(100)
        onDone(msg.videoUrl || '')
        es.close()
      } else if (msg.type === 'error') {
        onError?.(new Error(msg.error || 'Unknown error'))
        es.close()
      }
    } catch (err) {
      onError?.(err)
    }
  }

  es.onerror = (err) => {
    onError?.(err)
    es.close()
  }

  return () => es.close()
} 