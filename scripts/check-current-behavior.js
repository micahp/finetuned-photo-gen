require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');
const Replicate = require('replicate');

async function checkCurrentBehavior() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🖥️  Checking Current UI Behavior\n');
  
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
    
    console.log('📊 RAW DATA:');
    console.log('============');
    console.log('Job Queue Status:', job.status);
    console.log('Job Queue Error:', job.errorMessage || 'none');
    console.log('User Model Status:', userModel?.status || 'not found');
    console.log('User Model HF Repo:', userModel?.huggingfaceRepo || 'none');
    console.log('User Model Ready:', userModel?.loraReadyForInference || false);
    console.log('Replicate Status:', replicateStatus.status);
    console.log('Replicate Error:', replicateStatus.error || 'none');
    console.log('');
    
    // Simulate what the unified status resolver would determine
    const hasHuggingFaceRepo = !!userModel?.huggingfaceRepo;
    const isModelReady = userModel?.status === 'ready' && userModel?.loraReadyForInference;
    const replicateSucceeded = replicateStatus.status === 'succeeded';
    
    console.log('🧠 LOGIC ANALYSIS:');
    console.log('==================');
    console.log('Has HuggingFace Repo:', hasHuggingFaceRepo);
    console.log('Is Model Ready:', isModelReady);
    console.log('Replicate Succeeded:', replicateSucceeded);
    console.log('');
    
    let predictedStatus, predictedStage, needsUpload = false;
    
    if (hasHuggingFaceRepo && isModelReady) {
      predictedStatus = 'completed';
      predictedStage = 'Training completed successfully and model uploaded to HuggingFace';
    } else if (replicateSucceeded && !hasHuggingFaceRepo) {
      predictedStatus = 'uploading';
      predictedStage = 'Training completed successfully, ready for upload to HuggingFace';
      needsUpload = true;
    } else if (replicateStatus.status === 'failed') {
      predictedStatus = 'failed';
      predictedStage = 'Training failed';
    } else {
      predictedStatus = job.status;
      predictedStage = 'Status unclear';
    }
    
    console.log('🎯 PREDICTED UI BEHAVIOR:');
    console.log('=========================');
    console.log(`Status Badge: "${predictedStatus}"`);
    console.log(`Stage Text: "${predictedStage}"`);
    console.log(`Needs Upload Button: ${needsUpload ? 'YES' : 'NO'}`);
    console.log('');
    
    console.log('📝 WHAT USER WOULD SEE:');
    console.log('=======================');
    if (needsUpload) {
      console.log('🟡 Blue "Uploading" badge');
      console.log('📤 "Ready for Upload" button visible');
      console.log('💬 "Training completed successfully, ready for upload to HuggingFace"');
    } else if (predictedStatus === 'completed') {
      console.log('✅ Green "Completed" badge');
      console.log('🎉 "Training completed successfully and model uploaded to HuggingFace"');
    } else {
      console.log(`❓ "${predictedStatus}" badge`);
      console.log(`💬 "${predictedStage}"`);
    }
    
  } catch (error) {
    console.error('Error checking behavior:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentBehavior(); 