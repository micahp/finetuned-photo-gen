export interface FalEndpointSpec {
  /** Fully-qualified Fal endpoint slug, e.g. "fal-ai/veo3" */
  endpointId: string
  /** Generation category returned by the spec ("image-to-video", "text-to-video", etc.) */
  category: string
  /** Allowed aspect-ratio enum supplied by the spec, if present */
  aspectRatioEnum?: string[]
  /** Allowed duration enum supplied by the spec, if present */
  durationEnum?: string[]
  /** Any additional request parameter names surfaced by the spec that we want to track */
  extraParams: string[]
} 