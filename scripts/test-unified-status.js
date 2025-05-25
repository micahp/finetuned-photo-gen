require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');
const Replicate = require('replicate');

async function testUnifiedStatusResolver() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🧪 Testing Unified Status Resolver\n');
  
  // Test with the problematic training ID
  const testTrainingId = 'r7y4cc09kdrma0cq0hz8jnr50g';
  
  try {
    // Get job queue status
    const job = await prisma.jobQueue.findFirst({
      where: {
        jobType: 'model_training',
        payload: {
          path: ['externalTrainingId'],
          equals: testTrainingId
        }
      }
    });
    
    // Get user model status
    const userModel = await prisma.userModel.findFirst({
      where: { externalTrainingId: testTrainingId }
    });
    
    // Get Replicate status
    const replicateStatus = await replicate.trainings.get(testTrainingId);
    
    console.log('📊 Current Status Sources:');
    console.log('Job Queue:', {
      status: job?.status,
      error: job?.errorMessage,
      completedAt: job?.completedAt
    });
    console.log('User Model:', {
      status: userModel?.status,
      huggingfaceRepo: userModel?.huggingfaceRepo,
      loraReady: userModel?.loraReadyForInference
    });
    console.log('Replicate:', {
      status: replicateStatus.status,
      error: replicateStatus.error
    });
    
    // Build status sources for resolver
    const sources = {
      jobQueue: {
        status: job?.status || 'unknown',
        errorMessage: job?.errorMessage,
        completedAt: job?.completedAt
      },
      replicate: {
        status: replicateStatus.status,
        error: replicateStatus.error,
        logs: replicateStatus.logs
      },
      userModel: {
        status: userModel?.status || 'unknown',
        huggingfaceRepo: userModel?.huggingfaceRepo,
        loraReadyForInference: userModel?.loraReadyForInference || false,
        trainingCompletedAt: userModel?.trainingCompletedAt
      }
    };
    
    // Simulate the resolver logic (since we can't import the TypeScript module directly)
    const hasHuggingFaceRepo = !!userModel?.huggingfaceRepo;
    const isModelReady = userModel?.status === 'ready' && userModel?.loraReadyForInference;
    
    let resolvedStatus, stage, progress, needsUpload = false, canRetryUpload = false;
    
    if (hasHuggingFaceRepo && isModelReady) {
      resolvedStatus = 'completed';
      stage = 'Training completed successfully and model uploaded to HuggingFace';
      progress = 100;
    } else if (replicateStatus.status === 'succeeded' && !hasHuggingFaceRepo) {
      resolvedStatus = 'uploading';
      stage = 'Training completed successfully, ready for upload to HuggingFace';
      progress = 90;
      needsUpload = true;
      canRetryUpload = true;
    } else if (replicateStatus.status === 'succeeded' && hasHuggingFaceRepo && !isModelReady) {
      resolvedStatus = 'uploading';
      stage = 'Training completed, uploading to HuggingFace...';
      progress = 95;
    } else if (replicateStatus.status === 'failed') {
      resolvedStatus = 'failed';
      stage = 'Training failed';
      progress = 0;
    } else if (replicateStatus.status === 'processing') {
      resolvedStatus = 'training';
      stage = 'Training LoRA model (this may take 15-30 minutes)';
      progress = 40;
    } else {
      resolvedStatus = 'starting';
      stage = 'Preparing training environment';
      progress = 10;
    }
    
    console.log('\n🎯 Resolved Status:');
    console.log('Status:', resolvedStatus);
    console.log('Stage:', stage);
    console.log('Progress:', progress + '%');
    console.log('Needs Upload:', needsUpload);
    console.log('Can Retry Upload:', canRetryUpload);
    
    console.log('\n💡 Expected UI Behavior:');
    if (needsUpload && canRetryUpload) {
      console.log('✅ Should show "Ready for Upload" button');
      console.log('✅ Should show "uploading" status badge');
      console.log('✅ Pipeline stages should show training complete, upload pending');
    } else if (resolvedStatus === 'completed') {
      console.log('✅ Should show "Completed" status');
      console.log('✅ Should show HuggingFace repo link');
      console.log('✅ All pipeline stages should be green');
    } else if (resolvedStatus === 'failed') {
      console.log('❌ Should show "Failed" status');
      console.log('❌ Should show error message');
      console.log('❌ Pipeline should show which stage failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testUnifiedStatusResolver(); 