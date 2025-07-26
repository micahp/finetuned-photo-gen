# Fal.ai SSE vs Polling – Progress-log Visibility

This note explains **why live percentage logs appear in API-level logs but never reach the React client** for Fal.ai video jobs, even though the same UI shows progress for Replicate jobs.

---

## 1. Two Independent Code Paths

| Flow | API Route | Transport | Who Emits Progress? |
|------|-----------|-----------|----------------------|
| **Replicate** | `POST /api/replicate/stream` *(single request)* | **Server-Sent Events (SSE)** – HTTP connection stays open | Replicate service pushes log / output JSON. The browser consumes it directly. |
| **Fal.ai** | `POST /api/video/generate` ➊ → returns *jobId* | JSON (plain HTTP) | No progress here – just an ID. |
| | Front-end starts **polling** `GET /api/video/status/[jobId]` ➋ | JSON (plain HTTP) | Our backend asks `fal.queue.status()`, which returns coarse status (`IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`). *Logs are often empty between flushes.* |
| | *(Alternative we just built)* `GET /api/fal/stream?modelId=…&requestId=<jobId>` | **SSE** | Proxy parses Fal’s live log stream → emits `{type:'log'}` & `{type:'progress'}`. |

Only Replicate follows the SSE path by default, which is why its percentages show up instantly in the UI.

---

## 2. Why You See Logs in **Server** Console but Not in **Browser**

1. **Backend Polling Prints Everything**  
   `FalVideoService.getJobStatus()` calls `fal.queue.status()` with `{ logs: true }`. The Node process prints whatever logs array it receives, so you see messages in *server* stdout.
2. **Client Never Receives Those Logs**  
   The `/api/video/status/[jobId]` response intentionally **drops the `logs` array** and returns only a simplified shape (`status`, `videoUrl`, etc.). Hence the browser sees *no* percentage info even when the server just logged it.
3. **SSE Proxy Unused**  
   Our new `/api/fal/stream` route does convert live logs into client-friendly events, but the current video flow never calls it.

---

## 3. Options to Surface Progress in the UI

### A. Switch to SSE for Fal Jobs *(Recommended)*
1. After `POST /api/video/generate` resolves, open an `EventSource`:

   ```ts
   const es = new EventSource(
     `/api/fal/stream?modelId=${modelId}&requestId=${jobId}`
   )
   ```
2. Handle events `{type:'log'}`, `{type:'progress'}`, `{type:'done'}`, `{type:'error'}` just like Replicate.
3. Remove or downgrade the JSON polling.

### B. Keep Polling but Parse Progress
1. In `FalVideoService.getJobStatus()` extract `parseFalProgress()` from each log line in `result.logs`.
2. Return `pct` in the JSON response; the front-end can update a progress bar.
3. Still lower fidelity (depends on poll interval) but zero wiring changes on the client.

---

## 4. Collision Confusion & LLM Mis-reads

Having **two similarly named yet independent mechanisms** (polling JSON vs. SSE proxy) causes developers – and LLMs – to mix up which file drives which feature. Consolidating to a single mechanism or adding clear inline comments helps prevent that confusion.

---

### TL;DR
*Replicate shows progress because the browser is connected to an SSE stream that emits it. Fal doesn’t, because we poll a JSON endpoint that strips logs. Attach the browser to `/api/fal/stream` (or include `pct` in the poll response) and the percentages will appear.* 