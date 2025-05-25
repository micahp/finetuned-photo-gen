require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  console.log('🧪 Testing API Response for Training Job...\n');
  
  // Test what the API will return
  const modelId = 'cmb2toofr0001shbztnmo9rqu';
  const externalTrainingId = 'r7y4cc09kdrma0cq0hz8jnr50g';
  
  // Find the job queue entry
  const job = await prisma.jobQueue.findFirst({
    where: {
      jobType: 'model_training',
      payload: {
        path: ['externalTrainingId'],
        equals: externalTrainingId
      }
    }
  });
  
  if (job) {
    console.log('Job Queue Entry:');
    console.log(`  Status: ${job.status}`);
    console.log(`  Error Message: ${job.errorMessage || 'none'}`);
    console.log(`  Payload:`, JSON.stringify(job.payload, null, 2));
  }
  
  // Find the user model
  const model = await prisma.userModel.findUnique({
    where: { id: modelId }
  });
  
  if (model) {
    console.log('\nUser Model:');
    console.log(`  Status: ${model.status}`);
    console.log(`  HF Repo: ${model.huggingfaceRepo || 'none'}`);
    console.log(`  LoRA Ready: ${model.loraReadyForInference}`);
  }
  
  // The key insight: What will the API return?
  console.log('\n📊 API Logic Analysis:');
  
  if (job) {
    if (job.status === 'succeeded') {
      console.log('✓ Job status is "succeeded" - API will call TrainingService.getTrainingStatus()');
      
      // Check what getTrainingStatus would return
      console.log('  - Replicate status: succeeded');
      console.log('  - Model shows as training in database');
      console.log('  - No HuggingFace repo in database');
      console.log('  - TrainingService will return status "uploading" (needs upload)');
      console.log('  - Stage will be something like "Training completed successfully, ready for upload"');
    }
  }
  
  console.log('\n💡 Current Issue:');
  console.log('The retry upload button condition checks for:');
  console.log('  1. error?.includes("Model training completed successfully")');
  console.log('  2. debugData?.lastError?.stage === "huggingface_upload"');
  console.log('');
  console.log('But our current model state may not trigger these conditions.');
  console.log('We need to either:');
  console.log('  A) Fix the button condition logic');
  console.log('  B) Ensure the API returns the right data to trigger it');
  
  await prisma.$disconnect();
}

main().catch(console.error); 