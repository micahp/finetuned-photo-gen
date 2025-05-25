require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');
const Replicate = require('replicate');

async function testAllProblematicJobs() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🔍 Testing All Problematic Training Jobs\n');
  
  // All the problematic training IDs from our earlier investigation
  const problematicJobs = [
    {
      name: 'Main test case - should show "ready for upload"',
      trainingId: 'andamhvr2hrmc0cq0gr841nrrr'
    },
    {
      name: 'Zip creation error case',
      trainingId: '1gkyqjtg3drmc0cq0gert4phe4'
    },
    {
      name: 'Another succeeded case',
      trainingId: 'r7y4cc09kdrma0cq0hz8jnr50g'
    },
    {
      name: 'Status check case',
      trainingId: 'cmb2ml591003zsh8ie2zk3ha7'
    },
    {
      name: 'Additional test case',
      trainingId: 'cm9xqjtg3drmc0cq0gert4phe4'
    }
  ];
  
  for (const testCase of problematicJobs) {
    console.log(`🧪 Testing: ${testCase.name}`);
    console.log(`Training ID: ${testCase.trainingId}`);
    console.log('='.repeat(80));
    
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
      
      if (!job) {
        console.log('❌ Job not found in queue');
        console.log('');
        continue;
      }
      
      // Get user model status
      const userModel = await prisma.userModel.findFirst({
        where: { externalTrainingId: testCase.trainingId }
      });
      
      // Get replicate status
      let replicateStatus;
      try {
        const training = await replicate.trainings.get(testCase.trainingId);
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
      
      console.log('📊 RAW DATA:');
      console.log('   Job Queue Status:', job.status);
      console.log('   Job Queue Error:', job.errorMessage || 'none');
      console.log('   User Model Status:', userModel?.status || 'not found');
      console.log('   User Model HF Repo:', userModel?.huggingfaceRepo || 'none');
      console.log('   User Model Ready:', userModel?.loraReadyForInference || false);
      console.log('   Replicate Status:', replicateStatus.status);
      console.log('   Replicate Error:', replicateStatus.error || 'none');
      console.log('');
      
      // Simulate what the unified status resolver would determine
      const hasHuggingFaceRepo = !!userModel?.huggingfaceRepo;
      const isModelReady = userModel?.status === 'ready' && userModel?.loraReadyForInference;
      const replicateSucceeded = replicateStatus.status === 'succeeded';
      const replicateFailed = replicateStatus.status === 'failed';
      
      let predictedStatus, predictedStage, needsUpload = false, canRetryUpload = false;
      
      if (hasHuggingFaceRepo && isModelReady) {
        predictedStatus = 'completed';
        predictedStage = 'Training completed successfully and model uploaded to HuggingFace';
      } else if (replicateSucceeded && !hasHuggingFaceRepo) {
        predictedStatus = 'uploading';
        predictedStage = 'Training completed successfully, ready for upload to HuggingFace';
        needsUpload = true;
        canRetryUpload = true;
      } else if (replicateFailed) {
        predictedStatus = 'failed';
        if (replicateStatus.error?.toLowerCase().includes('zip') || 
            replicateStatus.error?.toLowerCase().includes('image')) {
          predictedStage = 'Failed during image preparation';
        } else {
          predictedStage = 'Training failed';
        }
      } else if (replicateStatus.status === 'processing') {
        predictedStatus = 'training';
        predictedStage = 'Training LoRA model (this may take 15-30 minutes)';
      } else if (replicateStatus.status === 'starting') {
        predictedStatus = 'starting';
        predictedStage = 'Preparing training environment';
      } else {
        // Fallback to job queue status
        predictedStatus = job.status;
        if (job.status === 'succeeded' && !hasHuggingFaceRepo) {
          predictedStatus = 'uploading';
          predictedStage = 'Training completed successfully, ready for upload to HuggingFace';
          needsUpload = true;
          canRetryUpload = true;
        } else {
          predictedStage = 'Status unclear - check logs';
        }
      }
      
      console.log('🎯 PREDICTED UI BEHAVIOR:');
      console.log(`   Status Badge: "${predictedStatus}"`);
      console.log(`   Stage Text: "${predictedStage}"`);
      console.log(`   Needs Upload Button: ${needsUpload ? 'YES' : 'NO'}`);
      console.log(`   Can Retry Upload: ${canRetryUpload ? 'YES' : 'NO'}`);
      console.log('');
      
      console.log('📝 WHAT USER WOULD SEE:');
      if (needsUpload) {
        console.log('   🟡 Blue "Uploading" badge');
        console.log('   📤 "Ready for Upload" button visible');
        console.log(`   💬 "${predictedStage}"`);
      } else if (predictedStatus === 'completed') {
        console.log('   ✅ Green "Completed" badge');
        console.log(`   🎉 "${predictedStage}"`);
      } else if (predictedStatus === 'failed') {
        console.log('   🔴 Red "Failed" badge');
        console.log(`   ❌ "${predictedStage}"`);
      } else {
        console.log(`   ❓ "${predictedStatus}" badge`);
        console.log(`   💬 "${predictedStage}"`);
      }
      
    } catch (error) {
      console.error('   ❌ Error testing job:', error.message);
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('');
  }
  
  await prisma.$disconnect();
}

testAllProblematicJobs(); 