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
  onLog?: (line: string) => void,
  onStatus?: (status: string) => void,
) {
  let maxProgress = 0
  const url = `/api/fal/stream?modelId=${encodeURIComponent(modelId)}&requestId=${requestId}`
  const es = new EventSource(url)

  es.onopen = () => {
    // eslint-disable-next-line no-console
    console.log('[ES] open')
  }

  es.onerror = (err) => {
    // eslint-disable-next-line no-console
    console.error('[ES] error', err)
    onError?.(err)
  }

  es.onmessage = (ev) => {
    try {
      const msg: any = JSON.parse(ev.data.trim())
      // eslint-disable-next-line no-console
      console.log('[ES RX]', msg)
      if (msg.type === 'log') {
        onLog?.(msg.message || '')
        return
      }
      if (msg.type === 'progress') {
        if (msg.pct > maxProgress) {
          maxProgress = msg.pct
          onProgress(maxProgress)
        }
      } else if (msg.type === 'status') {
        onStatus?.(msg.status)
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

  return () => es.close()
} 