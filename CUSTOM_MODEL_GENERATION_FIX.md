# Custom Model Generation Fix & Testing Guide

## 🎯 Problem Solved

Your fine-tuned FLUX models uploaded to HuggingFace weren't working properly with Together.ai's LoRA generation. The main issues were:

1. **Incorrect path formatting** - Together.ai expects `username/repo` format, not full URLs
2. **Poor trigger word integration** - Trigger words weren't being properly formatted
3. **Limited debugging** - No visibility into what was failing
4. **Insufficient validation** - Models with validation issues weren't being caught

## ✅ Fixes Implemented

### 1. Fixed LoRA Path Formatting (`src/lib/together-ai.ts`)

**Before:**
```typescript
// Incorrectly formatted as full URL
formattedLoraPath = `https://huggingface.co/${params.loraPath}`
```

**After:**
```typescript
// Correctly formats as username/repo
if (params.loraPath.startsWith('https://huggingface.co/')) {
  formattedLoraPath = params.loraPath.replace('https://huggingface.co/', '')
} else {
  formattedLoraPath = params.loraPath // Already in correct format
}
```

### 2. Enhanced Trigger Word Integration

**Before:**
```typescript
const enhancedPrompt = params.triggerWord 
  ? `${params.triggerWord} ${params.prompt}`
  : params.prompt
```

**After:**
```typescript
const enhancedPrompt = params.triggerWord 
  ? `${params.triggerWord}, ${params.prompt}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',')
  : params.prompt
```

### 3. Added Comprehensive Logging

Now you'll see detailed logs in the console:
- 🎯 LoRA Generation Request details
- ✨ Enhanced prompt with trigger word
- 🤗 HuggingFace LoRA path being used
- 🎨 Generation result status

### 4. Enhanced API Validation (`src/app/api/generate/route.ts`)

Added validation for:
- Model corruption status
- HuggingFace repository availability
- Better error messages for users

## 🧪 How to Test

### Option 1: Run the Test Script

```bash
# Test the LoRA generation functionality
node scripts/test-custom-model-generation.js
```

This will test:
- Basic LoRA generation with a known working model
- Trigger word integration
- Different path formats
- API payload structure

### Option 2: Test in the UI

1. **Go to the Generate page** (`/dashboard/generate`)
2. **Select a custom model** from your trained models
3. **Use the trigger word** in your prompt (it should auto-suggest)
4. **Generate an image** and check the browser console for logs

### Option 3: Test with API Directly

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "a professional headshot",
    "userModelId": "your-model-id",
    "aspectRatio": "1:1",
    "steps": 20
  }'
```

## 🔍 Debugging Guide

### Check These First

1. **Model Status in Database**
   ```sql
   SELECT id, name, status, loraReadyForInference, validationStatus, huggingfaceRepo 
   FROM UserModel 
   WHERE userId = 'your-user-id';
   ```

2. **HuggingFace Repository**
   - Verify the repo exists: `https://huggingface.co/username/repo-name`
   - Check it's public or you have access
   - Ensure it contains the LoRA files (`.safetensors`)

3. **Browser Console Logs**
   Look for these log messages:
   - 🎯 LoRA Generation Request
   - ✨ Enhanced prompt
   - 🤗 Using HuggingFace LoRA path
   - 🎨 LoRA Generation Result

### Common Issues & Solutions

#### Issue: "Model not found or not ready"
**Solution:** Check that your model has:
- `status: 'ready'`
- `loraReadyForInference: true`
- `validationStatus: 'valid'` (or null/unknown)

#### Issue: "HeaderTooLarge" or corruption errors
**Solution:** The LoRA file is corrupted. Re-train the model or check the safetensors file.

#### Issue: "Generation failed" with no specific error
**Solution:** Check the console logs for the actual Together.ai API error.

#### Issue: Trigger word not working
**Solution:** Make sure you're using the exact trigger word from the model, and it's being prepended to your prompt.

## 📊 Expected Behavior

### Successful Generation Flow

1. **User selects custom model** → UI shows trigger word hint
2. **User enters prompt** → Trigger word auto-prepends if not present
3. **Generation starts** → Console shows detailed logs
4. **API processes** → Validates model, formats LoRA path
5. **Together.ai generates** → Uses FLUX.1-dev-lora with your LoRA
6. **Image returns** → Saved to database with model reference

### Console Log Example (Success)

```
🎯 Generating with custom model: {
  modelId: "cm123...",
  modelName: "John Doe",
  huggingfaceRepo: "username/john-doe-flux",
  triggerWord: "johndoe",
  prompt: "johndoe, professional headshot in office",
  steps: 28
}

🎯 LoRA Generation Request: {
  originalPrompt: "professional headshot in office",
  loraPath: "username/john-doe-flux",
  triggerWord: "johndoe",
  useTogetherModel: false
}

✨ Enhanced prompt: johndoe, professional headshot in office
🤗 Using HuggingFace LoRA path: username/john-doe-flux

🎨 LoRA Generation Result: {
  status: "completed",
  hasImages: true,
  error: undefined
}
```

## 🚀 Next Steps

1. **Test with your models** - Use the test script or UI to verify generation works
2. **Check the logs** - Browser console will show detailed debugging info
3. **Verify model status** - Ensure your models are properly marked as ready
4. **Update any corrupted models** - Re-train if you see corruption errors

## 🔧 Technical Details

### LoRA Generation Parameters

- **Model**: `black-forest-labs/FLUX.1-dev-lora` (automatically selected for LoRA)
- **Steps**: 28 (higher than base model for better quality)
- **Path Format**: `username/repo-name` (not full URL)
- **Trigger Word**: Prepended with comma separation

### API Endpoints Used

- **Generation**: `POST /api/generate` with `userModelId`
- **Model List**: `GET /api/models` (filtered for ready models)
- **Together.ai**: `POST https://api.together.xyz/v1/images/generations`

### Database Fields

- `huggingfaceRepo`: The repository path (e.g., "username/model-name")
- `triggerWord`: The word to use in prompts
- `loraReadyForInference`: Must be `true` for generation
- `validationStatus`: Should be `'valid'` or `null`

---

**Your custom model generation should now work correctly!** 🎉

The key fix was the path formatting - Together.ai expects just the repository path, not the full HuggingFace URL. Combined with better trigger word handling and comprehensive logging, you should now be able to generate images with your fine-tuned models successfully. 