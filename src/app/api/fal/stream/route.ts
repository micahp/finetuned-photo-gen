// src/app/api/fal/stream/route.ts – simplified SSE proxy (attach-only)
import { NextRequest } from 'next/server'
import { fal } from '@fal-ai/client'
import { parseFalProgress } from '@/lib/fal-progress-parser'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const modelId   = searchParams.get('modelId')   || ''
  const requestId = searchParams.get('requestId') || ''

  if (!modelId || !requestId) {
    return new Response('modelId and requestId are required', { status: 400 })
  }

  const apiKey = process.env.FAL_API_TOKEN || ''
  if (!apiKey) {
    return new Response('Server mis-configuration: missing Fal API key', { status: 500 })
  }

  // Always (re)configure – cheap no-op if identical to existing config
  fal.config({ credentials: apiKey })

  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    start(controller) {
      /* ------------------------------------------------------------------ */
      /* helpers                                                            */
      /* ------------------------------------------------------------------ */
      let closed = false
      const close = () => {
        if (!closed) {
          closed = true
          controller.close()
        }
      }
      const send = (payload: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data:${JSON.stringify(payload)}\n\n`))
        } catch { close() }
      }

      /* ------------------------------------------------------------------ */
      /* open upstream stream with retry (handles early 404 / 405)          */
      /* ------------------------------------------------------------------ */
      const upstreamUrl = `https://queue.fal.run/${modelId}/requests/${requestId}/status/stream?logs=1`

      const openStream = async (): Promise<Response> => {
        let attempt = 0
        while (attempt < 8) {
          const res = await fetch(upstreamUrl, {
            headers: { Authorization: `Key ${apiKey}` },
          })
          if (res.ok && res.body) return res
          const transient = res.status === 404 || res.status === 405
          if (!transient) throw new Error(`Upstream error ${res.status}`)
          await new Promise(r => setTimeout(r, 250 + attempt * 200))
          attempt += 1
        }
        throw new Error('Upstream stream unavailable after retries')
      }

      /* ------------------------------------------------------------------ */
      /* stream → client                                                    */
      /* ------------------------------------------------------------------ */
      ;(async () => {
        try {
          // Kick-start EventSource (bypass 1 KB buffering)
          controller.enqueue(encoder.encode(':' + ' '.repeat(2048) + '\n\n'))

          const seenLogs = new Set<string>()
          const upstream  = await openStream()
          const reader    = upstream.body!.getReader()
          const decoder   = new TextDecoder()
          let   buffer    = ''

          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            let idx
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
              const rawEvent = buffer.slice(0, idx)
              buffer        = buffer.slice(idx + 2)
              const dataLine = rawEvent.split('\n').find(l => l.startsWith('data:'))
              if (!dataLine) continue

              try {
                const update: any = JSON.parse(dataLine.slice(5))

                // forward new log lines
                if (Array.isArray(update.logs)) {
                  for (const l of update.logs) {
                    if (seenLogs.has(l.message)) continue
                    seenLogs.add(l.message)
                    send({ type: 'log', message: l.message })
                    const pct = parseFalProgress(l.message)
                    if (pct !== null) send({ type: 'progress', pct })
                  }
                }

                // metrics-based progress (models without % logs)
                const metricPct = update?.metrics?.percent_complete
                if (typeof metricPct === 'number') {
                  send({ type: 'progress', pct: Math.round(metricPct) })
                }

                send({ type: 'status', status: update.status })

                if (update.status === 'COMPLETED') {
                  send({ type: 'done', videoUrl: update?.video?.url })
                  close()
                }
                if (update.status === 'FAILED') {
                  send({ type: 'error', error: 'Fal job failed' })
                  close()
                }
              } catch (err) {
                send({ type: 'error', error: String(err) })
              }
            }
          }
          close()
        } catch (err) {
          send({ type: 'error', error: String(err) })
          close()
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Content-Encoding': 'identity',
      'X-Accel-Buffering': 'no',
    },
  })
} 