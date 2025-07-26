# Fal Video Model Diff Report

*Generated: 2025-07-19T23:13:20.881Z*

## 1. Missing Endpoints in `VIDEO_MODELS`

- **fal-ai/fast-svd-lcm** (image-to-video)
- **fal-ai/fast-svd** (image-to-video)
- **fal-ai/hunyuan-avatar** (image-to-video)
- **fal-ai/hunyuan-video** (text-to-video)
- **fal-ai/kling-video/v2/master/image-to-video** (image-to-video)
- **fal-ai/ltx-video-13b-dev/extend** (video-to-video)
- **fal-ai/ltx-video-13b-dev/image-to-video** (image-to-video)
- **fal-ai/ltx-video-13b-distilled/multiconditioning** (video-to-video)
- **fal-ai/ltx-video-v095** (text-to-video)
- **fal-ai/ltx-video-v095/multiconditioning** (video-to-video)
- **fal-ai/ltx-video/image-to-video** (image-to-video)
- **fal-ai/magi/extend-video** (video-to-video)
- **fal-ai/magi/image-to-video** (image-to-video)
- **fal-ai/pixverse/v4.5/effects** (image-to-video)
- **fal-ai/pixverse/v4.5/text-to-video** (text-to-video)
- **fal-ai/stable-video** (image-to-video)
- **fal-ai/veo2/image-to-video** (image-to-video)
- **fal-ai/veo3/fast** (text-to-video)
- **fal-ai/wan-i2v** (image-to-video)
- **fal-ai/wan-t2v** (text-to-video)

## 2. Parameter Mismatches

### fal-ai/bytedance/seedance/v1/lite/text-to-video
- Aspect ratios (code): 16:9, 9:16, 1:1
- Aspect ratios (spec): 16:9, 4:3, 1:1, 9:21
- Durations (code): 5s, 10s
- Durations (spec): 5, 10

### fal-ai/bytedance/seedance/v1/pro/text-to-video
- Aspect ratios (code): 16:9, 9:16, 1:1
- Aspect ratios (spec): 21:9, 16:9, 4:3, 1:1, 3:4, 9:16
- Durations (code): 5s, 10s
- Durations (spec): 5, 10

### fal-ai/kling-video/v1.6/pro/image-to-video
- Durations (code): 5s, 10s
- Durations (spec): 5, 10

### fal-ai/kling-video/v2.1/master/image-to-video
- Aspect ratios (code): 16:9, 9:16, 1:1, 3:4, 4:3
- Aspect ratios (spec): 
- Durations (code): 5s, 10s
- Durations (spec): 5, 10

### fal-ai/kling-video/v2.1/pro/image-to-video
- Aspect ratios (code): 16:9, 9:16, 1:1, 3:4, 4:3
- Aspect ratios (spec): 
- Durations (code): 5s, 10s
- Durations (spec): 5, 10

### fal-ai/minimax/hailuo-02/pro/image-to-video
- Aspect ratios (code): 16:9, 9:16, 1:1, 3:4, 4:3
- Aspect ratios (spec): 
- Durations (code): 6s, 10s
- Durations (spec): 

### fal-ai/minimax/hailuo-02/standard/image-to-video
- Aspect ratios (code): 16:9, 9:16, 1:1, 3:4, 4:3
- Aspect ratios (spec): 
- Durations (code): 6s, 10s
- Durations (spec): 6, 10

### fal-ai/veo2
- Aspect ratios (code): 16:9, 9:16, 1:1
- Aspect ratios (spec): 16:9, 9:16

### fal-ai/veo3
- Aspect ratios (code): 16:9, 9:16, 1:1, 3:4, 4:3
- Aspect ratios (spec): 16:9, 9:16, 1:1
- Durations (code): 5s, 6s, 7s, 8s
- Durations (spec): 8s

