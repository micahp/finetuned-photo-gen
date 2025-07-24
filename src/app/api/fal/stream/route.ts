import { NextRequest } from 'next/server'
import { fal } from '@fal-ai/client'
import { parseFalProgress } from '@/lib/fal-progress-parser'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const modelId = searchParams.get('modelId') || ''
  const requestId = searchParams.get('requestId') || ''

  if (!modelId || !requestId) {
    return new Response('modelId and requestId are required', { status: 400 })
  }

  // Ensure the Fal client is configured with credentials for every request –
  // route handlers may run in new isolated contexts where global config from
  // other server modules (e.g. FalVideoService) hasn’t executed yet.
  const apiKey = process.env.FAL_API_TOKEN || ''
  if (!apiKey) {
    console.error('🔴 /api/fal/stream – FAL_API_TOKEN env var is missing')
    return new Response('Server mis-configuration: missing Fal API key', { status: 500 })
  }

  // (Re)configure the SDK on every invocation – client caches duplicate configs
  // and it’s a cheap no-op when unchanged.
  fal.config({ credentials: apiKey })
  const encoder = new TextEncoder()

  // Track whether the ReadableStream controller has been closed so that we
  // avoid the "Invalid state: Controller is already closed" exception that
  // can surface during hot-reload in dev. Once closed, all subsequent
  // payloads are silently dropped.
  let closed = false
  
  const stream = new ReadableStream({
    start(controller) {
      const closeController = () => {
        if (!closed) {
          closed = true
          controller.close()
        }
      }

      // Kick-start the EventSource on all browsers: send a 2 KB comment so
      // the first chunk exceeds the 1 KB buffering threshold that Chrome and
      // Safari apply to streaming responses.
      controller.enqueue(encoder.encode(':' + ' '.repeat(2048) + '\n\n'))

      // Helper that guards against "Invalid state: Controller is already closed"
      const safeSend = (payload: unknown) => {
        if (closed) return
        try {
          // Emit a lightweight diagnostic right before flushing bytes to the socket.
          // The client log will help us correlate missing events with potential
          // controller closure or proxy buffering issues.
          // eslint-disable-next-line no-console
          console.log('[FLUSH]', (payload as any)?.type ?? typeof payload, 'desiredSize', controller.desiredSize)

          controller.enqueue(encoder.encode(`data:${JSON.stringify(payload)}\n\n`))
        } catch {
          // Mark controller as closed so future writes are skipped.
          closed = true
        }
      }
      ;(async () => {
        try {
          // Track unique log messages so we only print new lines to the server console
          const seenLogs = new Set<string>()

          // -----------------------------------------------------------------
          // NEW: stream queue logs via official /status/stream endpoint
          // -----------------------------------------------------------------
          // Updated to use the documented queue status streaming endpoint
          // https://queue.fal.run/{model}/requests/{requestId}/status/stream?logs=1
          // NOTE: Do NOT URL-encode the modelId. It already forms part of the path
          // (contains a slash) and Fal’s queue endpoint expects the raw value
          // e.g. "fal-ai/ltxv-13b-098-distilled". Encoding the slash (%2F)
          // causes a 404/405 response and prevents the SSE from opening.
          const streamUrl = `https://queue.fal.run/${modelId}/requests/${requestId}/status/stream?logs=1`

          // Fal’s stream endpoint may return 404 or 405 while the job is still
          // in the queue.  Retry with back-off a few times before giving up.
          const MAX_RETRIES = 5
          let attempt = 0
          let upstream: Response | null = null

          while (attempt < MAX_RETRIES) {
            upstream = await fetch(streamUrl, {
              headers: { Authorization: `Key ${apiKey}` },
            })

            if (upstream.ok && upstream.body) break

            attempt += 1
            // eslint-disable-next-line no-console
            console.warn(`[STREAM RETRY] Attempt ${attempt} → status ${upstream.status}`)
            await new Promise(res => setTimeout(res, 1500 * attempt))
          }

          if (!upstream || !upstream.ok || !upstream.body) {
            throw new Error(`Upstream stream error after ${MAX_RETRIES} retries: ${upstream?.status}`)
          }

          const reader = upstream.body.getReader()
          const textDecoder = new TextDecoder()
          let buf = ''

          const processChunk = async (): Promise<void> => {
            const { value, done } = await reader.read()
            if (done) {
              closeController()
              return
            }
            buf += textDecoder.decode(value, { stream: true })

            // Split on double newlines (end of SSE event)
            let idx
            while ((idx = buf.indexOf('\n\n')) > -1) {
              const rawEvent = buf.slice(0, idx)
              buf = buf.slice(idx + 2)
              const dataLine = rawEvent.split('\n').find(l => l.startsWith('data:'))
              if (!dataLine) continue
              try {
                const update = JSON.parse(dataLine.replace(/^data:\s*/, ''))

                // Mirror previous logic for logs / progress / status
                // Forward any log lines provided by Fal regardless of the
                // exact status string.  Some endpoints report "PROCESSING"
                // or other custom states.
                if (Array.isArray(update.logs) && update.logs.length) {
                  for (const l of update.logs) {
                    const msg = l.message || ''
                    const pct = parseFalProgress(msg)

                    if (!seenLogs.has(msg)) {
                      seenLogs.add(msg)
                      // eslint-disable-next-line no-console
                      console.log('[SSE] log', msg, '→', pct)

                      // Forward *only new* log lines to the client so the
                      // browser doesn’t accumulate duplicates.
                      safeSend({ type: 'log', message: msg })
                      if (pct !== null) safeSend({ type: 'progress', pct })
                    }
                  }
                }

                // Some endpoints expose numeric progress under metrics.percent_complete
                const metricPct = (update as any)?.metrics?.percent_complete
                if (typeof metricPct === 'number' && metricPct >= 0 && metricPct <= 100) {
                  safeSend({ type: 'progress', pct: Math.round(metricPct) })
                }

                safeSend({ type: 'status', status: update.status })

                if (update.status === 'COMPLETED') {
                  safeSend({ type: 'done', videoUrl: update?.video?.url })
                  closeController()
                }
                if (update.status === 'FAILED') {
                  safeSend({ type: 'error', error: 'Fal job failed' })
                  closeController()
                }
              } catch (err) {
                safeSend({ type: 'error', error: String(err) })
              }
            }

            // Continue reading
            processChunk()
          }

          processChunk()
        } catch (err) {
          safeSend({ type: 'error', error: String(err) })
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      // Disable all intermediate buffering/compression proxies so that each
      // SSE chunk is flushed to the client immediately.
      'Cache-Control': 'no-cache, no-transform',
      'Content-Encoding': 'identity', // Explicitly opt-out of gzip on Vercel
      'X-Accel-Buffering': 'no',      // Nginx / Vercel hint
       
     },
   })
 } 