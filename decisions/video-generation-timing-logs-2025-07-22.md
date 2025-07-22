# Add Detailed Timing Logs for Video Generation Pipeline – 2025-07-22

## Context
Video generation latency was difficult to diagnose without granular measurements across the pipeline (Fal queue submission, render completion, download time, R2 upload, and Cloudflare propagation). The dashboard team requested timing instrumentation (see context summary High-Priority task).

## Decision
1. Introduced `perf_hooks.performance` and a lightweight `logDuration()` helper inside `FalVideoService`.
2. Instrumented the following stages with high-resolution (ms) logs:
   • Fal `queue.submit` API call.  
   • Video file download from Fal.  
   • Upload to Cloudflare R2.  
   • Cloudflare R2 HEAD check.
3. Each log line is prefixed with ⏱️  for quick grep-ability and follows the format:  
   `⏱️  <stage> took <N> ms`.
4. No external API or schema changes; logging is internal and incurs negligible overhead (<1 ms).

## Consequences
• Engineers can now correlate backend timings with dashboard progress bar behaviour and identify bottlenecks quickly.  
• The logs lay groundwork for future ingestion into Grafana/Tempo without code changes (simply ship logs via Loki).  
• Next step: instrument Fal completion timing once async job result is received (requires DB update path). 

## Update – Immediate Cloudflare Swap (2025-07-22)

The initial implementation used a fixed 5 s polling interval which resulted in up to ~10 s of extra latency before swapping from the Fal stream to the Cloudflare copy.  We have now:

1. Added an **immediate HEAD check** when `VideoPlayerWithFallback` mounts, capturing the common case where propagation has already finished.
2. Reduced the polling interval from **5 s → 2 s** for much snappier fallback removal when propagation is still in-flight.

Result: The visible delay has dropped from ~10 s to <2 s in most cases, often instant.  Unit test updated to reflect the new timing logic. 