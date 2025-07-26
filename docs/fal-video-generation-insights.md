# Fal Video Generation – Current Flow & Improvement Plan

## 1. Overview
This document summarises how the codebase currently handles **Fal.ai video-generation** jobs compared to **Replicate model-training** workflows, then outlines concrete improvements to make the Fal path as robust as the training path while keeping implementation minimal.

---

## 2. Current Pipelines

### 2.1 Fal Video Generation
1. **UI** – `src/app/dashboard/video/page.tsx` posts `FormData` to `/api/video/generate`.
2. **API Route** – `/api/video/generate`:
   - Auth + up-front credit deduction.
   - Instantiates `FalVideoService` → `generateVideo()`.
   - Uses `fal.queue.submit()` (always async) → returns `request_id`.
   - Saves **`generatedVideo`** row with `status = processing` + `falJobId`.
3. **Progress** – Browser opens `EventSource` → `/api/fal/stream` (SSE proxy). Client parses log lines via `parseFalProgress`.
4. **Polling** – UI hits `/api/video/status/[jobId]` which calls `FalVideoService.getJobStatus()`:
   - `fal.queue.status(...)` → if `COMPLETED` fetches result.
   - Downloads MP4, re-uploads to R2, updates DB row ➜ `status = completed`.

### 2.2 Replicate Training
1. **UI** – POST `/api/models/start-training`.
2. **`TrainingService.startTraining`**
   - Builds training ZIP, calls `ReplicateService.startTraining()` (`trainings.create`).
   - Creates **`jobQueue`** row (`jobType = model_training`).
   - Updates **`userModel`** row with `externalTrainingId`.
3. **Status Polling** – UI hits `/api/training/jobs` or `/api/training/jobs/[id]`.
   - Status resolver merges data from **jobQueue**, **Replicate API**, and **userModel**.
   - Parses logs for % progress.
4. **Completion** – When Replicate returns `succeeded`, uploads LoRA to HF, updates DB rows, leaves credits untouched until inference usage.

---

## 3. Key Differences
| Concern                     | Fal Video Generation | Replicate Training |
|-----------------------------|----------------------|--------------------|
| Job persistence            | `generatedVideo` only | `jobQueue` + `userModel` |
| Status reconciliation      | Single Fal API call  | Three-way merge |
| Credit timing              | Deduct **before** job | Deduct later during inference |
| Progress parsing           | Client-side only via SSE | Server-side via logs |
| Retry / back-pressure      | None                 | Possible via jobQueue |

---

## 4. Improvement Plan for Fal Flow

1. **Record a `jobQueue` entry** (`jobType = video_generation`).<br/>Gives ops a single table to monitor & enables retries/back-off identical to training jobs.
2. **Move progress parsing server-side** in `/api/fal/stream`.
   - Use existing `parseFalProgress` util; emit structured `{type:"progress", pct}` events.
   - Persist last % in `jobQueue.payload` for page refresh safety.
3. **Credit safety** – put credits in *pending* state; finalise on `completed`, refund on `failed`.
4. **Resilient polling** – add exponential back-off + TTL in `getJobStatus`; mark jobs `failed` after N minutes.
5. **Streamed R2 upload** – pipe the `fetch` response stream directly to R2 instead of buffering full MP4.
6. **Telemetry** – send Fal errors & queue failures to Sentry; attach Fal error codes.

Implementing 1-3 gives us parity with the Replicate pipeline; 4-7 are incremental hardening steps. 