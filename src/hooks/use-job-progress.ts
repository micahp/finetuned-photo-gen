import { useEffect, useRef, useState } from 'react'
import { subscribeFalJob } from '@/lib/fal-log-subscriber'

export interface JobProgress {
  pct: number
  status: string
  error?: string
}

interface UseJobProgressProps {
  provider: 'fal' | 'replicate' | 'other'
  modelId: string
  jobId: string
  /**
   * Callback fired when the job finishes successfully.
   * For video generation this is when pct === 100 & status === 'COMPLETED'.
   */
  onDone?: () => void
  /** Callback fired when the job fails */
  onError?: (err: unknown) => void
}

/**
 * Unified progress tracker for long-running model jobs.
 *
 * 1. Prefers SSE when the provider supports it (Fal, Replicate).
 * 2. Falls back to JSON polling of `/api/video/status/[jobId]` for others.
 * 3. Returns a `{ pct, status }` object so UI components stay oblivious to transport details.
 */
export function useJobProgress({
  provider,
  modelId,
  jobId,
  onDone,
  onError,
}: UseJobProgressProps): JobProgress {
  const [pct, setPct] = useState(0)
  const [status, setStatus] = useState('PENDING')
  const pollTimeout = useRef<NodeJS.Timeout>()
  const unsubscribeRef = useRef<() => void>()

  useEffect(() => {
    // Clear any previous trackers when inputs change
    unsubscribeRef.current?.()
    if (pollTimeout.current) clearTimeout(pollTimeout.current)
    setPct(0)
    setStatus('PENDING')

    if (!jobId) {
      return // no active job → nothing to track yet
    }

    if (provider === 'fal') {
      // Prefer SSE proxy
      unsubscribeRef.current = subscribeFalJob(
        modelId,
        jobId,
        (p) => {
          setPct(p)
        },
        () => {
          setPct(100)
          setStatus('COMPLETED')
          onDone?.()
        },
        (err) => {
          // Fallback to polling
          console.error('Fal SSE error, falling back to polling', err)
          startPolling()
          onError?.(err)
        },
        undefined,
        (s) => setStatus(s)
      )
    } else if (provider === 'replicate') {
      // Replicate already returns SSE on its own URL
      // Directly open EventSource to their endpoint
      const es = new EventSource(`/api/replicate/stream?requestId=${jobId}`)
      es.onmessage = (ev) => {
        try {
          const data: any = JSON.parse(ev.data)
          if (typeof data.pct === 'number') setPct(data.pct)
          if (data.status) setStatus(data.status)
          if (data.status === 'COMPLETED') {
            setPct(100)
            onDone?.()
            es.close()
          }
        } catch {}
      }
      es.onerror = (err) => {
        console.error('Replicate SSE error', err)
        es.close()
        startPolling()
        onError?.(err)
      }
      unsubscribeRef.current = () => es.close()
    } else {
      // Unknown provider → poll only
      startPolling()
    }

    return () => {
      unsubscribeRef.current?.()
      if (pollTimeout.current) clearTimeout(pollTimeout.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, modelId, jobId])

  /** Poll `/api/video/status/[jobId]` every 5 s until COMPLETE/FAILED */
  const startPolling = () => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/video/status/${jobId}`)
        if (res.ok) {
          const json = await res.json()
          if (json?.success) {
            const video = json.video || {}
            if (typeof video.progress === 'number') setPct(video.progress)
            if (video.status) setStatus(video.status)
            if (video.status === 'completed') {
              setPct(100)
              onDone?.()
              return // stop polling
            }
            if (video.status === 'failed') {
              setStatus('FAILED')
              onError?.(new Error('Job failed'))
              return
            }
          }
        }
      } catch (err) {
        console.error('Job progress poll error', err)
      }
      pollTimeout.current = setTimeout(poll, 5000)
    }
    poll()
  }

  return { pct, status }
} 