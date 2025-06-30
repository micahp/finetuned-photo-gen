# 🧪 FAL.AI QUEUE INTEGRATION TEST GUIDE

## **Overview**
We've **eliminated the webhook requirement** for fal.ai video generation. The system now uses `fal.queue.submit()` for async jobs and polls status via `getJobStatus()` - **no inbound HTTPS endpoint needed**.

## **✅ What Changed**

### **Before (Webhook-based)**
```typescript
// Required FAL_WEBHOOK_URL environment variable
const webhookUrl = process.env.FAL_WEBHOOK_URL
if (webhookUrl) {
  const result = await fal.subscribe(model.falModelId, {
    input: requestPayload,
    webhookUrl: webhookUrl,  // ❌ Required public HTTPS endpoint
    onQueueUpdate: (update) => console.log(update)
  })
}
```

### **After (Queue-based)**
```typescript
// No webhook URL needed - uses outbound polling
try {
  const submitResult = await fal.queue.submit(model.falModelId, {
    input: requestPayload  // ✅ Just submit and get request_id
  })
  
  return {
    id: submitResult.request_id,
    status: 'processing'
  }
} catch (queueError) {
  // Graceful fallback to synchronous generation
  const result = await fal.run(model.falModelId, { input: requestPayload })
}
```

## **🎯 Test Scenarios**

### **1. Async Video Generation (Primary Path)**
**Test**: Submit video generation job using queue
```bash
curl -X POST http://localhost:3000/api/video/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "a cat playing in a sunny garden",
    "modelId": "seedance-lite-text",
    "duration": 5,
    "aspectRatio": "16:9"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "jobId": "req_abc123def456",
  "status": "processing",
  "estimatedTime": 120
}
```

### **2. Job Status Polling**
**Test**: Check status of submitted job
```bash
curl -X GET "http://localhost:3000/api/video/status/req_abc123def456" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Responses**:
```json
// While processing
{
  "id": "req_abc123def456",
  "status": "processing"
}

// When completed
{
  "id": "req_abc123def456", 
  "status": "completed",
  "videoUrl": "https://your-r2-bucket.com/videos/video_req_abc123def456.mp4",
  "thumbnailUrl": "https://your-r2-bucket.com/videos/video_req_abc123def456_thumbnail.jpg",
  "duration": 5,
  "fileSize": 2456789,
  "width": 1344,
  "height": 768,
  "fps": 24
}
```

### **3. Image-to-Video Generation**
**Test**: Upload image and generate video
```bash
curl -X POST http://localhost:3000/api/video/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@test-image.jpg" \
  -F "prompt=smooth camera movement revealing the scene" \
  -F "modelId=seedance-lite-image" \
  -F "duration=5"
```

### **4. Fallback to Sync Generation**
**Test**: Verify graceful fallback when queue submission fails
- Temporarily break fal.ai API credentials
- Submit generation request
- Should fallback to `fal.run()` and return completed video immediately

### **5. Error Handling**
**Test**: Invalid model or parameters
```bash
curl -X POST http://localhost:3000/api/video/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "test",
    "modelId": "invalid-model",
    "duration": 999
  }'
```

## **🔧 Environment Setup**

### **Required Environment Variables**
```bash
# Fal.ai API (required)
FAL_API_TOKEN=your_fal_api_key

# Cloudflare R2 for video storage (required)
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret
CLOUDFLARE_R2_BUCKET_NAME=your_bucket
CLOUDFLARE_R2_ENDPOINT=your_r2_endpoint

# NO LONGER NEEDED:
# FAL_WEBHOOK_URL (removed - no inbound webhooks!)
```

### **Local Development Setup**
```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Start development server
npm run dev

# 4. Test endpoint is ready
curl http://localhost:3000/api/health
```

## **🚀 Testing Workflow**

### **Phase 1: Basic Queue Integration**
1. ✅ Start development server
2. ✅ Submit text-to-video generation job
3. ✅ Verify job returns `processing` status with valid `request_id`
4. ✅ Poll status endpoint until completion
5. ✅ Verify video is uploaded to Cloudflare R2
6. ✅ Confirm no webhook errors in logs

### **Phase 2: Image-to-Video**
1. ✅ Test image upload + video generation
2. ✅ Verify image is properly encoded as base64 data URL
3. ✅ Check video quality and motion preservation

### **Phase 3: Error Recovery**
1. ✅ Test queue submission failures
2. ✅ Verify fallback to synchronous generation
3. ✅ Test invalid parameters handling
4. ✅ Test insufficient credits scenarios

### **Phase 4: Production Validation**
1. ✅ Deploy to staging environment
2. ✅ Test with real fal.ai API limits
3. ✅ Verify CloudFlare R2 performance
4. ✅ Load test with multiple concurrent jobs

## **📊 Expected Performance**

### **Queue Submission**
- **Latency**: < 2 seconds to submit job
- **Response**: Immediate `request_id` return
- **No Blocking**: UI stays responsive

### **Video Processing**
- **Seedance Lite**: ~60-90 seconds for 5s video
- **Seedance Pro**: ~90-120 seconds for 5s video  
- **Hailuo**: ~120-180 seconds for 6s video
- **Kling**: ~180-300 seconds for 5s video

### **Status Polling**
- **Frequency**: Every 5-10 seconds
- **Completion Check**: Via `fal.queue.status()` and `fal.queue.result()`

## **🐛 Troubleshooting**

### **Job Stuck in Processing**
```bash
# Check fal.ai queue status directly
curl -X GET "https://queue.fal.run/fal-ai/bytedance/seedance/v1/lite/text-to-video/requests/req_abc123def456/status" \
  -H "Authorization: Key YOUR_FAL_API_TOKEN"
```

### **Queue Submission Fails**
- ✅ Check fal.ai API credentials
- ✅ Verify model ID exists and is accessible
- ✅ Check request payload format
- ✅ System should gracefully fallback to sync generation

### **Video Upload Fails**
- ✅ Check Cloudflare R2 credentials
- ✅ Verify bucket permissions
- ✅ Check network connectivity to R2 endpoint

## **📝 Log Monitoring**

### **Successful Queue Flow**
```
🎬 Starting video generation with Fal.ai: { model: "Seedance 1.0 Lite", mode: "text-to-video" }
📡 Sending request to Fal.ai Seedance: { model: "fal-ai/bytedance/seedance/v1/lite/text-to-video" }
✅ Fal.ai async job submitted (queue): { requestId: "req_abc123def456", status: "processing" }

// Later, during status check:
📊 Fal.ai queue status: { status: "COMPLETED" }
📊 Fal.ai queue result: { data: { video: { url: "..." }, image: { url: "..." } } }
🔄 Processing and uploading video to CloudFlare R2...
✅ Video uploaded to CloudFlare R2: { url: "https://...", thumbnailUrl: "https://..." }
```

### **Fallback to Sync**
```
❌ Fal.ai queue submission failed, falling back to synchronous run: [error details]
✅ Fal.ai Seedance video generation completed: { requestId: "...", hasVideo: true }
```

## **🎉 Success Criteria**

- ✅ **No webhook infrastructure required**
- ✅ **Queue submission works for all models**
- ✅ **Status polling returns accurate job progress**
- ✅ **Videos are successfully uploaded to R2**
- ✅ **Graceful fallback to sync generation**
- ✅ **No breaking changes to existing API contracts**
- ✅ **Performance matches or exceeds webhook approach**

---

**Status**: Ready for testing ✅  
**Breaking Changes**: None (API contracts preserved)  
**Infrastructure Simplification**: Webhook endpoint eliminated  
**Next Steps**: Delete old webhook routes and `FAL_WEBHOOK_URL` references 