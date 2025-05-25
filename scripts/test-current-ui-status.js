require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');
const Replicate = require('replicate');

// Import the unified status resolver
const { TrainingStatusResolver } = require('../src/lib/training-status-resolver.ts');

async function testCurrentUIStatus() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🖥️  Testing Current UI Status Display\n');
  
  // Test the main problematic training job
  const testTrainingId = 'andamhvr2hrmc0cq0gr841nrrr';
  
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
    
    if (!job) {
      console.log('❌ Job not found in queue');
      return;
    }
    
    // Get user model status
    const userModel = await prisma.userModel.findFirst({
      where: { externalTrainingId: testTrainingId }
    });
    
    // Get replicate status
    let replicateStatus;
    try {
      const training = await replicate.trainings.get(testTrainingId);
      replicateStatus = {
        status: training.status,
        error: training.error,
        logs: training.logs
      };
    } catch (error) {
      replicateStatus = {
        status: 'unknown',
        error: error.message
      };
    }
    
    // Build status sources
    const sources = {
      jobQueue: {
        status: job.status,
        errorMessage: job.errorMessage,
        completedAt: job.completedAt
      },
      replicate: replicateStatus,
      userModel: {
        status: userModel?.status || 'not found',
        huggingfaceRepo: userModel?.huggingfaceRepo,
        loraReadyForInference: userModel?.loraReadyForInference || false,
        trainingCompletedAt: userModel?.trainingCompletedAt
      }
    };
    
    // Resolve unified status
    const unifiedStatus = TrainingStatusResolver.resolveStatus(
      testTrainingId,
      job.payload?.name || 'Test Model',
      sources
    );
    
    console.log('📊 CURRENT UI STATUS:');
    console.log('===================');
    console.log(`Status Badge: "${unifiedStatus.status}"`);
    console.log(`Progress: ${unifiedStatus.progress}%`);
    console.log(`Stage Text: "${unifiedStatus.stage}"`);
    console.log(`Error: ${unifiedStatus.error || 'none'}`);
    console.log(`HuggingFace Repo: ${unifiedStatus.huggingFaceRepo || 'none'}`);
    console.log('');
    
    console.log('🎯 UI BEHAVIOR:');
    console.log('===============');
    if (unifiedStatus.needsUpload) {
      console.log('✅ SHOWS: "Ready for Upload" button');
      console.log('✅ SHOWS: Upload section with blue card');
    } else {
      console.log('❌ HIDES: Upload button');
    }
    
    if (unifiedStatus.canRetryUpload) {
      console.log('✅ SHOWS: "Retry Upload" option');
    }
    
    if (unifiedStatus.status === 'completed') {
      console.log('✅ SHOWS: Green "Completed" badge');
      console.log('✅ SHOWS: All pipeline stages as green');
    } else if (unifiedStatus.status === 'uploading') {
      console.log('🟡 SHOWS: Blue "Uploading" badge');
      console.log('🟡 SHOWS: Pipeline stages with upload in progress');
    } else if (unifiedStatus.status === 'failed') {
      console.log('🔴 SHOWS: Red "Failed" badge');
      console.log('🔴 SHOWS: Error message');
    }
    
    console.log('');
    console.log('📝 WHAT USER SEES:');
    console.log('==================');
    console.log(`"${unifiedStatus.stage}"`);
    if (unifiedStatus.needsUpload) {
      console.log('👆 With a blue "Upload to HuggingFace" button below');
    }
    
  } catch (error) {
    console.error('Error testing UI status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCurrentUIStatus(); 