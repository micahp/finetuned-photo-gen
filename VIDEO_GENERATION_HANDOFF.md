# Video Generation Handoff - Image-to-Video Issues

## Current Status: ❌ NOT FIXED

The image-to-video functionality is still broken despite recent attempts to fix it. The core issue is that we're sending incorrect parameters to the Fal.ai Seedance API.

## Key Issues Identified

### 1. **API Parameter Mismatch** 🚨
**Problem**: Our code sends parameters that Fal.ai Seedance doesn't recognize
- We send: `duration_seconds`, `aspect_ratio`, `fps`, `motion_bucket_id`, `width`, `height`
- Seedance expects: `duration` (5 or 10), `resolution` (480p or 720p), `camera_fixed` (boolean)

**Evidence from logs**:
```
✅ Fal.ai video generation completed: { requestId: undefined, hasVideo: false, hasImage: false }
```

### 2. **Synchronous Processing Issues**
**Problem**: When no webhook is configured, Fal.ai should return results immediately, but we're getting empty responses
- No `requestId` returned
- No video or image data returned
- We create a fallback job ID that doesn't exist in Fal.ai's system

### 3. **Status Check Failures**
**Problem**: 404 errors when checking job status
```
❌ Fal.ai job status check error: Error: Status check failed: 404
```

## Work Completed ✅

1. **Identified parameter mismatch** in `src/lib/fal-video-service.ts`
2. **Started fixing API parameters** but implementation is incomplete
3. **Added better error handling** for custom job IDs

## Work Remaining 🔧

### Priority 1: Fix API Parameters
**File**: `src/lib/fal-video-service.ts`
**Action needed**: Complete the Seedance-specific parameter mapping

```typescript
// Current (broken):
const payload = {
  prompt: enhancedPrompt,
  duration_seconds: duration,
  aspect_ratio: params.aspectRatio || '16:9',
  fps: params.fps || 24,
  motion_bucket_id: params.motionBucketId || 5,
  width: 1344,
  height: 768,
  seed: params.seed,
  image_url: imageUrl
}

// Should be (for Seedance):
const payload = {
  prompt: enhancedPrompt,
  image_url: imageUrl,
  duration: Math.min(duration, 10), // 5 or 10 only
  resolution: "720p", // or "480p"
  camera_fixed: false, // boolean
  seed: params.seed
}
```

### Priority 2: Fix Response Handling
**Files**: 
- `src/lib/fal-video-service.ts` (lines ~140-180)
- `src/app/api/video/generate/route.ts`

**Issues**:
- Handle synchronous responses properly
- Don't create custom job IDs when Fal.ai returns real data
- Return proper error messages when generation fails

### Priority 3: Test with Real API
**Action**: Create a test script to verify the fix works

## Debug Information

### Recent Logs (January 1, 2025)
```
📡 Sending request to Fal.ai: {
  model: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
  payload: {
    duration_seconds: 5,  // ❌ Wrong parameter name
    aspect_ratio: '16:9', // ❌ Not supported by Seedance
    fps: 24,              // ❌ Not supported by Seedance
    motion_bucket_id: 5,  // ❌ Not supported by Seedance
    width: 1344,          // ❌ Not supported by Seedance
    height: 768,          // ❌ Not supported by Seedance
  }
}
```

### User Account Status
- User: `micahgp@gmail.com`
- Credits: 1000+ (sufficient for testing)
- Admin access: Available for debugging

## References

1. **Fal.ai Seedance Documentation**: Parameters should be `prompt`, `image_url`, `duration` (5|10), `resolution` ("480p"|"720p"), `camera_fixed` (boolean)
2. **Current Implementation**: `src/lib/fal-video-service.ts` lines 78-150
3. **Test Cases**: User attempted waterfall image-to-video generation

## Next Steps

1. **Fix the parameter mapping** in `generateVideo()` method
2. **Test with a simple image-to-video request**
3. **Verify credits are properly deducted/refunded**
4. **Update error handling** to provide better user feedback

## Success Criteria

- [ ] Video generation returns actual video URL
- [ ] No 404 errors in status checks
- [ ] Credits properly deducted only on success
- [ ] User sees generated video in dashboard

---
**Created**: January 1, 2025  
**Status**: Needs immediate attention  
**Estimated fix time**: 1-2 hours 