// ─── FAL.ai Seedance 2.0 API client ───

const FAL_API_BASE = "https://queue.fal.run/fal-ai/seedance-v2-pro";

interface FalSubmission {
  request_id: string;
}

interface FalStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  request_id: string;
  response_url?: string;
  error?: string;
  logs?: Array<{ message: string }>;
}

interface FalResult {
  video?: { url: string };
  images?: Array<{ url: string }>;
}

export interface GenerateResult {
  requestId: string;
  status: "queued" | "running" | "done" | "failed";
  videoUrl?: string;
  error?: string;
}

function getApiKey(): string {
  // In a real app, this would come from secure storage
  // For now, we read from AsyncStorage at runtime
  throw new Error("API key not loaded — call initFalClient(key) first");
}

let _apiKey: string | null = null;

export function initFalClient(key: string) {
  _apiKey = key;
}

export function isFalConfigured(): boolean {
  return _apiKey !== null && _apiKey.length > 0;
}

/**
 * Resolve a relative FAL URL to an absolute one.
 */
function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `https://fal.ai${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Submit a generation request to Seedance 2.0.
 * @param prompt - The text prompt (max 5000 chars in Chinese)
 * @param imageUrls - Optional reference image URLs (max 9)
 * @param videoUrls - Optional reference video URLs (max 3)
 * @param aspectRatio - "16:9" | "9:16" | "1:1"
 * @param duration - Video duration in seconds (5, 10, or 15)
 */
export async function submitSeedanceJob(
  prompt: string,
  imageUrls: string[] = [],
  videoUrls: string[] = [],
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9",
  duration: 5 | 10 | 15 = 5,
): Promise<{ requestId: string }> {
  if (!_apiKey) throw new Error("FAL API key not configured");

  const payload: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    duration,
    num_inference_steps: 30,
    guidance_scale: 7.5,
  };

  if (imageUrls.length > 0) {
    payload.reference_images = imageUrls.slice(0, 9);
  }
  if (videoUrls.length > 0) {
    payload.reference_videos = videoUrls.slice(0, 3);
  }

  const response = await fetch(FAL_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${_apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`FAL API error ${response.status}: ${err}`);
  }

  const data: FalSubmission = await response.json();
  return { requestId: data.request_id };
}

/**
 * Poll the status of a generation request.
 */
export async function checkJobStatus(requestId: string): Promise<GenerateResult> {
  if (!_apiKey) throw new Error("FAL API key not configured");

  const response = await fetch(`${FAL_API_BASE}/requests/${requestId}/status`, {
    headers: {
      Authorization: `Key ${_apiKey}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`FAL status error ${response.status}: ${err}`);
  }

  const data: FalStatus = await response.json();

  let videoUrl: string | undefined;
  if (data.status === "COMPLETED" && data.response_url) {
    // Fetch the result
    const resultResp = await fetch(resolveUrl(data.response_url), {
      headers: { Authorization: `Key ${_apiKey}` },
    });
    if (resultResp.ok) {
      const result: FalResult = await resultResp.json();
      videoUrl = result.video?.url;
    }
  }

  const statusMap: Record<string, GenerateResult["status"]> = {
    IN_QUEUE: "queued",
    IN_PROGRESS: "running",
    COMPLETED: "done",
    FAILED: "failed",
  };

  return {
    requestId,
    status: statusMap[data.status] ?? "failed",
    videoUrl,
    error: data.error,
  };
}

/**
 * Convenience: submit and poll until done (with max wait).
 * Returns the video URL on success.
 */
export async function generateVideo(
  prompt: string,
  imageUrls: string[] = [],
  videoUrls: string[] = [],
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9",
  duration: 5 | 10 | 15 = 5,
  maxWaitMs: number = 600_000, // 10 min
  pollIntervalMs: number = 5000, // 5 sec
): Promise<GenerateResult> {
  const { requestId } = await submitSeedanceJob(
    prompt,
    imageUrls,
    videoUrls,
    aspectRatio,
    duration,
  );

  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const result = await checkJobStatus(requestId);
    if (result.status === "done" || result.status === "failed") {
      return result;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return { requestId, status: "failed", error: "Timed out waiting for generation" };
}
