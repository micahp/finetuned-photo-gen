# Fal SSE Buffering & Dev Proxy Issues – Diagnosis & Quick Fixes

> Applies to: local **Next.js** dev server (`npm run dev`) streaming routes such as `/api/fal/stream`.
>
> Symptoms: Progress bar stalls, EventSource console logs stop appearing, or browser receives SSE payloads only after job completes.

---

## 1  Confirm the Stream Leaves Node.js

Run `curl` in a second terminal **while a job is running**:

```bash
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3000/api/fal/stream?modelId=<MODEL_ID>&requestId=<REQUEST_ID>"
```

Expected within ≈2 s:

```text
:                                                                                                   # 2 kB pad
data:{"type":"status","status":"IN_PROGRESS"}

data:{"type":"log","message":" 12%|█▎ | 1/8 …"}
data:{"type":"progress","pct":12}
```

### Interpretation

| Result | Meaning | Next Step |
|--------|---------|-----------|
| `curl` **streams live events** | Node is flushing correctly ⇒ blockage is in *browser or dev proxy*. | Jump to § 3. |
| `curl` **shows nothing** or prints everything **at the end** | Gzip / buffering still active in Node. | Jump to § 2. |

---

## 2  If `curl` Is Still Buffered

### 2a  Disable Compression (quickest test)

Edit `next.config.js` (root):

```js
module.exports = {
  compress: false,      // ⛔ turn off gzip in dev & prod
  // …rest of config
}
```

Restart the dev server and repeat the `curl` test. If the stream now flows, refresh the browser – `[ES RX]` logs should appear.

### 2b  Move Route to the Edge Runtime (alt / additive)

```ts
// src/app/api/fal/stream/route.ts
export const runtime = 'edge'      // replaces 'nodejs'
```

Edge runtime never gzips streamed responses and flushes each chunk immediately.

---

## 3  If `curl` Streams but the **Browser** Doesn’t

1. **DevTools → Network** → select the `/api/fal/stream` request → **Preview** tab.  
   • If the JSON chunks keep appending here, Node is fine.
2. **But** the console logs stay silent ⇒ a hot-reload overlay or extension is hijacking `EventSource`.  
   • Hard-refresh (⇧⌘R) or an Incognito window usually clears it.

---

## 4  Why These Fixes Work

Next.js’ dev middleware registers its gzip compression layer **before** user code.  
`Cache-Control: no-transform` + `Content-Encoding: identity` tells *proxies* to skip gzip, but the internal Express-like layer has already zipped the stream.  Setting `compress: false` or switching the route to **Edge** prevents gzip from ever running, ensuring every SSE chunk is flushed instantly.” 