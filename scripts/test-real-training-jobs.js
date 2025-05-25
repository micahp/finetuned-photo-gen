require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');
const Replicate = require('replicate');

async function testRealTrainingJobs() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🔍 Testing All Real Training Jobs\n');
  
  // Real training IDs from the database
  const realJobs = [
    'r7y4cc09kdrma0cq0hz8jnr50g',  // completed
    'andamhvr2hrmc0cq0gr841nrrr',   // succeeded
    '1gkyqjtg3drmc0cq0gert4phe4',   // failed - zip error
    'my5135kezdrma0cq0fwvwabpsg',   // failed - zip error
    'cmb2ml591003zsh8ie2zk3ha7',    // completed
    'cmb2melm7003bsh8ig31n5chq',    // failed - model exists
    'dccb056ycsrma0cq0exskg188c',   // failed - zip error
    'cmb2lviuf001zsh8ixl1oqfus',    // failed - permission
    'cmb2lcano001bsh8ijzvdyiba',    // failed - permission
    'cmb2l9k4x000nsh8ii6t4r2gb'     // completed
  ];
  
  for (const trainingId of realJobs) {
    console.log(`🧪 Testing Training ID: ${trainingId}`);
    console.log('='.repeat(60));
    
    try {
      // Get job queue status
      const job = await prisma.jobQueue.findFirst({
        where: {
          jobType: 'model_training',
          payload: {
            path: ['externalTrainingId'],
            equals: trainingId
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
        where: { externalTrainingId: trainingId }
      });
      
      // Get replicate status (with timeout)
      let replicateStatus;
      try {
        const training = await replicate.trainings.get(trainingId);
        replicateStatus = {
          status: training.status,
          error: training.error
        };
      } catch (error) {
        replicateStatus = {
          status: 'unknown',
          error: error.message
        };
      }
      
      // Determine what the unified status resolver would show
      const hasHuggingFaceRepo = !!userModel?.huggingfaceRepo;
      const isModelReady = userModel?.status === 'ready' && userModel?.loraReadyForInference;
      const replicateSucceeded = replicateStatus.status === 'succeeded';
      const replicateFailed = replicateStatus.status === 'failed';
      
      let predictedStatus, predictedStage, needsUpload = false;
      
      if (hasHuggingFaceRepo && isModelReady) {
        predictedStatus = 'completed';
        predictedStage = 'Training completed successfully and model uploaded to HuggingFace';
      } else if (replicateSucceeded && !hasHuggingFaceRepo) {
        predictedStatus = 'uploading';
        predictedStage = 'Training completed successfully, ready for upload to HuggingFace';
        needsUpload = true;
      } else if (replicateFailed || job.status === 'failed') {
        predictedStatus = 'failed';
        const errorMsg = replicateStatus.error || job.errorMessage || '';
        if (errorMsg.toLowerCase().includes('zip') || errorMsg.toLowerCase().includes('image')) {
          predictedStage = 'Failed during image preparation';
        } else if (errorMsg.toLowerCase().includes('permission')) {
          predictedStage = 'Failed due to permission error';
        } else if (errorMsg.toLowerCase().includes('already exists')) {
          predictedStage = 'Failed - model name already exists';
        } else {
          predictedStage = 'Training failed';
        }
      } else if (job.status === 'succeeded' && !hasHuggingFaceRepo) {
        predictedStatus = 'uploading';
        predictedStage = 'Training completed successfully, ready for upload to HuggingFace';
        needsUpload = true;
      } else if (job.status === 'completed') {
        predictedStatus = 'completed';
        predictedStage = 'Training completed successfully';
      } else {
        predictedStatus = job.status;
        predictedStage = 'Status unclear';
      }
      
      console.log(`📊 Job: ${job.status} | Replicate: ${replicateStatus.status} | Model: ${userModel?.status || 'none'}`);
      console.log(`🎯 UI: ${predictedStatus} | ${needsUpload ? 'UPLOAD BUTTON' : 'no upload'}`);
      console.log(`💬 "${predictedStage}"`);
      
      if (job.errorMessage) {
        console.log(`❌ Error: ${job.errorMessage.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.error('❌ Error testing job:', error.message);
    }
    
    console.log('');
  }
  
  await prisma.$disconnect();
}

testRealTrainingJobs(); 