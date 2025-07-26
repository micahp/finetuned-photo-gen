import { useEffect, useRef, useState } from 'react'

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
  /** Optional callback for raw log lines */
  onLog?: (line: string) => void
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
  onLog,
}: UseJobProgressProps): JobProgress {
  const [pct, setPct] = useState(0)
  const [status, setStatus] = useState('PENDING')
  const pollTimeout = useRef<NodeJS.Timeout>()
  const lastLogRef = useRef<string[]>([])

  // Mark unused parameters to satisfy TypeScript no-unused-vars when strict options are enabled
  void provider
  void modelId

  useEffect(() => {
    if (pollTimeout.current) clearTimeout(pollTimeout.current)
    setPct(0)
    setStatus('PENDING')

    if (!jobId) return

    startPolling()

    return () => {
      if (pollTimeout.current) clearTimeout(pollTimeout.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  /** Poll `/api/video/status/[jobId]` every 5 s until COMPLETE/FAILED */
  const startPolling = () => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/video/status/${jobId}`)
        if (res.ok) {
          const json = await res.json()
          if (json?.success) {
            const video = json.video || {}
            if (Array.isArray(video.logs)) {
              const newLines = video.logs.filter((l: string) => !lastLogRef.current.includes(l))
              newLines.forEach(l => onLog?.(l))
              // Keep only last 50 lines
              lastLogRef.current = [...lastLogRef.current, ...newLines].slice(-50)
            }

            if (typeof video.progress === 'number') {
              let p = video.progress
              if (p >= 100 && (video.status ?? '').toLowerCase() !== 'completed') {
                p = 99
              }
              setPct(p)
            }
            if (video.status) setStatus(video.status)
            if (video.status === 'completed' || video.status === 'COMPLETED') {
              setPct(100)
              onDone?.()
              return // stop polling
            }
            if (video.status === 'failed' || video.status === 'FAILED') {
              setStatus('FAILED')
              onError?.(new Error('Job failed'))
              return
            }
          }
        }
      } catch (err) {
        console.error('Job progress poll error', err)
      }
      pollTimeout.current = setTimeout(poll, 1000)
    }
    poll()
  }

  return { pct, status }
} 