require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');
const Replicate = require('replicate');

async function testMultipleScenarios() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🧪 Testing Multiple Training Scenarios\n');
  
  // Test different problematic scenarios
  const testCases = [
    {
      name: 'Succeeded but needs upload',
      trainingId: 'andamhvr2hrmc0cq0gr841nrrr'
    },
    {
      name: 'Failed during zip creation',
      trainingId: '1gkyqjtg3drmc0cq0gert4phe4'
    },
    {
      name: 'Completed status check',
      trainingId: 'cmb2ml591003zsh8ie2zk3ha7'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`🔍 Testing: ${testCase.name}`);
    console.log(`Training ID: ${testCase.trainingId}\n`);
    
    try {
      // Get job queue status
      const job = await prisma.jobQueue.findFirst({
        where: {
          jobType: 'model_training',
          payload: {
            path: ['externalTrainingId'],
            equals: testCase.trainingId
          }
        }
      });
      
      // Get user model status
      const userModel = await prisma.userModel.findFirst({
        where: { externalTrainingId: testCase.trainingId }
      });
      
      // Get Replicate status (with error handling)
      let replicateStatus = { status: 'unknown', error: null };
      try {
        replicateStatus = await replicate.trainings.get(testCase.trainingId);
      } catch (replicateError) {
        console.log(`   ⚠️  Could not fetch Replicate status: ${replicateError.message}`);
        replicateStatus = { status: 'unknown', error: replicateError.message };
      }
      
      console.log('   📊 Status Sources:');
      console.log('   Job Queue:', {
        status: job?.status || 'not found',
        error: job?.errorMessage || 'none'
      });
      console.log('   User Model:', {
        status: userModel?.status || 'not found',
        huggingfaceRepo: userModel?.huggingfaceRepo || 'none',
        loraReady: userModel?.loraReadyForInference || false
      });
      console.log('   Replicate:', {
        status: replicateStatus.status,
        error: replicateStatus.error || 'none'
      });
      
      // Apply unified status resolution logic
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
      } else if (replicateStatus.status === 'failed' || job?.status === 'failed') {
        resolvedStatus = 'failed';
        const error = replicateStatus.error || job?.errorMessage || '';
        if (error.toLowerCase().includes('zip') || error.toLowerCase().includes('cloudflare')) {
          stage = 'Failed during image preparation';
        } else if (error.toLowerCase().includes('initializing')) {
          stage = 'Failed during initialization';
        } else if (error.toLowerCase().includes('permission') || error.toLowerCase().includes('403')) {
          stage = 'Failed during model creation (permission error)';
        } else if (error.toLowerCase().includes('already exists') || error.toLowerCase().includes('409')) {
          stage = 'Failed during model creation (name conflict)';
        } else {
          stage = 'Training failed';
        }
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
      
      console.log('\n   🎯 Resolved Status:');
      console.log(`   Status: ${resolvedStatus}`);
      console.log(`   Stage: ${stage}`);
      console.log(`   Progress: ${progress}%`);
      console.log(`   Needs Upload: ${needsUpload}`);
      console.log(`   Can Retry Upload: ${canRetryUpload}`);
      
      console.log('\n   💡 Expected UI Changes:');
      if (needsUpload && canRetryUpload) {
        console.log('   ✅ Should show "Ready for Upload" button');
        console.log('   ✅ Should show "uploading" status badge instead of "completed"');
      } else if (resolvedStatus === 'completed') {
        console.log('   ✅ Should show "Completed" status');
        console.log('   ✅ Should show HuggingFace repo link');
      } else if (resolvedStatus === 'failed') {
        console.log('   ❌ Should show "Failed" status');
        console.log(`   ❌ Should show specific error: "${stage}"`);
      }
      
    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
  
  await prisma.$disconnect();
}

testMultipleScenarios(); 