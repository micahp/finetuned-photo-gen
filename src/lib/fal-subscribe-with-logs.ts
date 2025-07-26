import { fal } from '@fal-ai/client'

/**
 * Subscribe to a Fal.ai queue stream and forward every log line in real-time.
 * Handles the transient 404/405 state that occurs for a few hundred ms after
 * job creation by retrying the subscribe call with exponential back-off.
 *
 * @param modelId e.g. "fal-ai/stable-video/text-to-video"
 * @param input   Plain input object accepted by the endpoint
 * @param onLog   Callback invoked for *every* new log message
 * @param onProgress Optional callback for explicit percent progress (where available)
 * @returns Resolves with the final Fal response once the job is completed.
 */
export async function subscribeWithLogs(
  modelId: string,
  input: Record<string, unknown>,
  onLog: (line: string) => void,
  onProgress?: (pct: number) => void,
) {
  // Attempt to open the stream, dealing with Fal’s brief 404/405 window.
  const openStream = async () => {
    let attempt = 0
    while (true) {
      try {
        return await fal.subscribe(modelId, {
          input,
          logs: true,
        }) as any
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status
        if ((status === 404 || status === 405) && attempt < 6) {
          await new Promise(r => setTimeout(r, 250 + attempt * 200))
          attempt += 1
          continue
        }
        throw err
      }
    }
  }

  const { logs: initialLogs, stream, data, requestId } = await openStream()

  // Flush any history immediately
  if (Array.isArray(initialLogs)) {
    for (const l of initialLogs) onLog(l.message)
  }

  // Consume incremental updates
  for await (const update of stream) {
    if (Array.isArray(update.logs)) {
      for (const l of update.logs) onLog(l.message)
    }
    const pct = (update as any)?.metrics?.percent_complete
    if (typeof pct === 'number' && onProgress) onProgress(Math.round(pct))
  }

  return {
    data,
    requestId,
  }
} 