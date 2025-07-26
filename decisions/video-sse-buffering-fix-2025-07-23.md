# Decision – Eliminate SSE Buffering & Extend Progress Regex (2025-07-23)

## Status
Accepted – implemented 2025-07-23.

## Context
Real-time progress logs were leaving `/api/fal/stream`, but browsers did not
fire `message` events until the connection closed.  Investigation showed two
separate issues:

1. **Buffered response** – In the Node.js runtime Next.js pipes streamed
   responses through gzip/compression.  Chrome/Safari hold < 1 KB payloads in
   their TCP buffers, so the first ~15 log lines never reached JavaScript.
2. **Decimal percentages** – LTX-Video and similar models emit `43.6 %` or
   `12/40` style logs.  The original `parseFalProgress()` only recognised
   integer percentages.

## Decision
1. **Force immediate flush**
   * Pre-pend a 2 KB comment (`':' + ' '.repeat(2048) + '\n\n'`) when the
     stream starts – guarantees the browser passes the 1 KB threshold.
   * Disable buffering/compression with headers:
     ```http
     Cache-Control: no-cache, no-transform
     Content-Encoding: identity
     X-Accel-Buffering: no
     ```
2. **Keep Node runtime** – No Edge-only APIs required; small change, lowest
   risk.  (If we later need per-chunk < 100 ms latency we can revisit `runtime:'edge'`).
3. **Broaden progress parser**
   * Replace `/ (\d{1,3})% /` with `/ (\d{1,3}(?:\.\d+)?)% /` to capture
     decimal percentages.
   * Fraction format (`current / total`) already handled; no change.

## Consequences
* Browsers receive the first log packet immediately; progress bar begins
  moving within ~200 ms of job start.
* No gzip means a few kilobytes more per generation – negligible.
* Decimal percentages now tick the bar smoothly for LTX-Video & future
  models.

## References
* GitHub discussion: *Server-Sent Events don’t work in Next API routes* #48427.
* Next.js docs: browsers buffer < 1 KB streams.
* StackOverflow Q61676262: SSE events delayed until `res.end()` when gzip is on. 