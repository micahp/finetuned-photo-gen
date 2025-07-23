import { NextRequest } from 'next/server'
import { fal } from '@fal-ai/client'
import { parseFalProgress } from '@/lib/fal-progress-parser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
          const streamUrl = `https://queue.fal.run/${encodeURIComponent(modelId)}/requests/${requestId}/status/stream?logs=1`

          // Fetch upstream SSE
          const upstream = await fetch(streamUrl, {
            headers: {
              Authorization: `Key ${apiKey}`,
            },
          })

          if (!upstream.ok || !upstream.body) {
            throw new Error(`Upstream stream error: ${upstream.status}`)
          }

          const reader = upstream.body.getReader()
          const textDecoder = new TextDecoder()
          let buf = ''

          const processChunk = async (): Promise<void> => {
            const { value, done } = await reader.read()
            if (done) {
              controller.close()
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
                if ((update.status === 'IN_PROGRESS' || update.status === 'STREAMING') && Array.isArray(update.logs)) {
                  for (const l of update.logs) {
                    const msg = l.message || ''
                    const pct = parseFalProgress(msg)

                    if (!seenLogs.has(msg)) {
                      seenLogs.add(msg)
                      // eslint-disable-next-line no-console
                      console.log('[SSE] log', msg, '→', pct)
                    }

                    safeSend({ type: 'log', message: msg })
                    if (pct !== null) safeSend({ type: 'progress', pct })
                  }
                }

                safeSend({ type: 'status', status: update.status })

                if (update.status === 'COMPLETED') {
                  safeSend({ type: 'done', videoUrl: update?.video?.url })
                  controller.close()
                }
                if (update.status === 'FAILED') {
                  safeSend({ type: 'error', error: 'Fal job failed' })
                  controller.close()
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
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
} 