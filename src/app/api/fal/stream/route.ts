// src/app/api/fal/stream/route.ts – simplified SSE proxy (attach-only)
import { NextRequest } from 'next/server'
import { parseFalProgress } from '@/lib/fal-progress-parser'
// Enable verbose debugging by setting DEBUG_FAL_SSE=1 in the environment
const DEBUG = process.env.DEBUG_FAL_SSE === '1'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    // Accept both camelCase and snake_case for flexibility
    const rawModelId = searchParams.get('modelId')   || searchParams.get('model_id')   || ''
    const modelId = decodeURIComponent(rawModelId)
    const requestId = searchParams.get('requestId') || searchParams.get('request_id') || ''

    if (!modelId || !requestId) {
      return new Response('modelId and requestId are required', { status: 400 })
    }

    const apiKey = process.env.FAL_API_TOKEN || ''
    if (!apiKey) {
      return new Response('Server mis-configuration: missing Fal API key', { status: 500 })
    }

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
        const urlEncoded = `https://queue.fal.run/${encodeURIComponent(modelId)}/requests/${requestId}/status/stream?logs=1`
        const urlRaw     = `https://queue.fal.run/${modelId}/requests/${requestId}/status/stream?logs=1`
        const candidateUrls = [urlEncoded, urlRaw]

        if (DEBUG) console.log('[SSE] candidate URLs', candidateUrls)

        const openStream = async (): Promise<Response> => {
          const startedAt = Date.now()
          let attempt = 0
          let delay = 500 // initial back-off in ms
          const MAX_DELAY = 5000 // cap individual delay to 5 s
          const MAX_WAIT  = 5 * 60 * 1000 // give up after 5 minutes

          while (Date.now() - startedAt < MAX_WAIT && !closed) {
            const url = candidateUrls[attempt % candidateUrls.length]
            attempt += 1

            if (DEBUG) console.log(`[SSE] Attempt ${attempt}→`, url)

            // Inform client we are still waiting so they can show spinner
            send({ type: 'heartbeat', waiting: true, attempt })

            const res = await fetch(url, {
              headers: { Authorization: `Key ${apiKey}` },
            })

            if (res.ok && res.body) {
              if (DEBUG) console.log('[SSE] Upstream stream opened', url)
              return res
            }

            if (DEBUG) console.log('[SSE] Upstream not ready', { status: res.status, url })

            const transient = res.status === 404 || res.status === 405 || res.status === 202
            if (!transient) {
              // Non-retryable error – surface immediately
              throw new Error(`Upstream error ${res.status}`)
            }

            // Wait with exponential back-off capped at MAX_DELAY
            await new Promise(r => setTimeout(r, delay))
            delay = Math.min(delay * 1.5, MAX_DELAY)
          }

          throw new Error('Upstream stream unavailable after max wait')
        }

        /* ------------------------------------------------------------------ */
        /* stream → client                                                    */
        /* ------------------------------------------------------------------ */
        ;(async () => {
          try {
            // Kick-start EventSource (bypass 1 KB buffering)
            controller.enqueue(encoder.encode(':' + ' '.repeat(2048) + '\n\n'))

            const upstream  = await openStream()
            // node-fetch returns a Node.js stream that doesn't implement getReader.
            // Convert it to a Web ReadableStream if necessary.
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore – Node 18+ exposes Readable to Web conversion.
            const webBody: ReadableStream<Uint8Array> = (typeof upstream.body?.getReader === 'function')
              ? (upstream.body as any)
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              : (await import('node:stream')).Readable.toWeb(upstream.body as any)

            const reader    = webBody.getReader()
            const decoder   = new TextDecoder()
            let   buffer    = ''

            if (DEBUG) console.log('[SSE] Start reading upstream')

            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })

              let idx
              while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, idx)
                buffer        = buffer.slice(idx + 2)
                const dataLineMatch = rawEvent.match(/^data:\s*(.+)$/m)
                if (!dataLineMatch) continue

                try {
                   const update: any = JSON.parse(dataLineMatch[1])

                    if (DEBUG) console.log('[SSE] update', {
                      status: update.status,
                      logs: Array.isArray(update.logs) ? update.logs.length : 0,
                      metricPct: update?.metrics?.percent_complete,
                    })

                    // forward new log lines
                    if (Array.isArray(update.logs)) {
                        for (const l of update.logs) {
                            send({ type: 'log', message: l.message })
                            const pct = parseFalProgress(l.message)
                            if (pct !== null) send({ type: 'progress', pct })
                            if (DEBUG) console.log('[SSE] forwarded log', l.message?.slice?.(0, 120) || '')
                            if (DEBUG) console.log('[SSE] forwarded pct', pct)
                        }
                    }

                    // metrics-based progress (models without % logs)
                    const metricPct = update?.metrics?.percent_complete
                    if (typeof metricPct === 'number') {
                        send({ type: 'progress', pct: Math.round(metricPct) })
                    }

                   // Emit heartbeat if we forwarded nothing else
                   if (!update.logs?.length && metricPct === undefined) {
                       send({ type: 'heartbeat' })
                   }

                   send({ type: 'status', status: update.status })
                   if (DEBUG) console.log('[SSE] forwarded status', update.status)

                  if (update.status === 'COMPLETED') {
                    send({ type: 'done', videoUrl: update?.video?.url })
                    if (DEBUG) console.log('[SSE] job completed, closing stream')
                    close()
                  }
                  if (update.status === 'FAILED') {
                    send({ type: 'error', error: 'Fal job failed' })
                    if (DEBUG) console.log('[SSE] job failed, closing stream')
                    close()
                  }
                } catch (err) {
                  send({ type: 'error', error: String(err) })
                  if (DEBUG) console.error('[SSE] JSON parse forward error', err)
                }
              }
            }
            close()
            if (DEBUG) console.log('[SSE] upstream closed')
          } catch (err) {
            send({ type: 'error', error: String(err) })
            if (DEBUG) console.error('[SSE] stream loop error', err)
            close()
          }
        })()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=120',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (e) {
    console.error('SSE route fatal:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
} 