# Together AI Training Integration

## Overview
⚠️ **Important Update**: After investigation, we discovered that Together AI's fine-tuning API currently supports **text models (LLMs) only**, not image models like FLUX. FLUX LoRA training is not available through their standard fine-tuning API.

However, we have implemented a complete training integration architecture that can be easily adapted when image model fine-tuning becomes available or when using alternative services.

## Current Status

### ✅ What's Implemented and Working:
- **Training Images Upload API** - Fully functional for uploading and managing training images
- **Model Creation Workflow** - Complete UI and backend for creating training jobs
- **Database Integration** - Full tracking of models, images, and training status
- **Local Storage System** - Images stored locally with accessible URLs
- **Enhanced UI/UX** - Professional multi-step model creation process

### ⚠️ Current Limitation:
- **Together AI FLUX LoRA Training** - Not currently supported by Together AI's API
- The training endpoint returns a descriptive error explaining this limitation

## Alternative Approaches

### Option 1: Use Existing FLUX Models
Continue using Together AI's existing FLUX models with advanced prompting:
```javascript
// Use existing FLUX models with detailed prompts
const response = await together.generateImage({
  prompt: 'portrait of a person with [detailed description], professional photography style',
  model: 'black-forest-labs/FLUX.1-dev',
  width: 1024,
  height: 1024
})
```

### Option 2: External Training Services
Integrate with services that support FLUX LoRA training:
- **Replicate** - Supports FLUX LoRA training
- **RunPod** - Custom training environments  
- **Paperspace** - ML training platform
- **Local Training** - Using tools like Kohya's scripts

### Option 3: Wait for Together AI Support
Monitor Together AI's roadmap for FLUX LoRA training support.

## Implementation Details

### 1. Training Images Upload API ✅
**File**: `src/app/api/models/training-images/route.ts`
- Handles uploading training images for a specific model
- Saves images to local storage (`public/uploads/{userId}/`)
- Creates database records in `TrainingImage` table
- Generates accessible URLs for training services
- Validates file formats, sizes, and counts

### 2. Training Start API ⚠️
**File**: `src/app/api/models/start-training/route.ts`
- Currently returns informative error about Together AI limitation
- Architecture ready for alternative training services
- Handles job queue creation and status tracking
- Easy to adapt when training becomes available

### 3. Enhanced Model Creation UI ✅
**File**: `src/app/dashboard/models/new/page.tsx`
- Complete multi-step model creation process
- Trigger word and base model configuration
- Real-time progress feedback
- Professional UI with validation

## Adapting for Alternative Services

The current architecture can be easily adapted for other training services:

```javascript
// Example: Integrating with Replicate for FLUX LoRA training
async function startReplicateTraining(params) {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  
  const training = await replicate.trainings.create(
    "ostris/flux-dev-lora-trainer",
    "e440909d3512c31646ee2e0c7d6f6f4923224863a6a10c494606e79fb5844497",
    {
      destination: `${username}/flux-lora-${modelName}`,
      input: {
        steps: 1000,
        lora_rank: 16,
        optimizer: "adamw8bit",
        batch_size: 1,
        resolution: "512,768,1024",
        autocaption: true,
        trigger_word: triggerWord,
        input_images: imageZipUrl // ZIP file of training images
      }
    }
  )
  
  return training
}
```

## Testing Current Implementation

You can test the complete workflow to see how it works:

1. **Upload Training Images** ✅
   ```bash
   # Navigate to /dashboard/models/new
   # Upload 5-20 training images
   # Images are saved locally and tracked in database
   ```

2. **Configure Model Details** ✅
   ```bash
   # Set model name, trigger word, base model
   # All validation and UI feedback working
   ```

3. **Training Attempt** ⚠️
   ```bash
   # Returns informative error about Together AI limitation
   # Job queue and status tracking still functional
   # Ready to swap in alternative training service
   ```

## Next Steps

### Immediate Options:
1. **Use Existing FLUX Models** - Continue with advanced prompting techniques
2. **Integrate Alternative Service** - Add Replicate, RunPod, or other training APIs
3. **Local Training Setup** - Implement local LoRA training workflow

### Future Integration:
1. **Monitor Together AI** - Watch for FLUX training support announcements
2. **Multi-Provider Support** - Support multiple training services
3. **Hybrid Approach** - Use Together AI for inference, external services for training

## File Structure

```
src/
├── app/api/models/
│   ├── create/route.ts              # ✅ Model creation
│   ├── training-images/route.ts     # ✅ Image upload
│   └── start-training/route.ts      # ⚠️ Training (limited by Together AI)
├── app/dashboard/models/new/page.tsx # ✅ Enhanced UI
├── lib/
│   ├── together-ai.ts              # ⚠️ Training method (limitation noted)
│   └── upload.ts                   # ✅ Local file utilities
└── components/upload/
    └── ImageUpload.tsx             # ✅ Image upload component
```

## Status: 🔄 READY FOR ADAPTATION

The training integration architecture is **complete and ready** to be connected to any training service that supports FLUX LoRA training. While Together AI doesn't currently support this, the entire workflow, UI, and backend are implemented and can be easily adapted when alternative solutions are chosen. 