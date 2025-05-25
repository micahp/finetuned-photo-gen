require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');
const Replicate = require('replicate');

async function checkHuggingFaceModelExists(repoId) {
  try {
    const response = await fetch(`https://huggingface.co/api/models/${repoId}`, {
      method: 'HEAD'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🧹 COMPREHENSIVE DATABASE CLEANUP\n');
  console.log('Finding all training jobs with external training IDs...\n');
  
  // Find all job queue entries with external training IDs
  const jobs = await prisma.jobQueue.findMany({
    where: {
      jobType: 'model_training',
      payload: {
        path: ['externalTrainingId'],
        not: null
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`📋 Found ${jobs.length} training jobs with external IDs\n`);
  
  let jobsFixed = 0;
  let modelsFixed = 0;
  let issuesFound = 0;
  
  for (const job of jobs) {
    const payload = job.payload;
    const externalTrainingId = payload.externalTrainingId;
    const userModelId = payload.userModelId;
    
    console.log(`🔍 Checking Job: ${job.id}`);
    console.log(`   External Training ID: ${externalTrainingId}`);
    console.log(`   User Model ID: ${userModelId}`);
    console.log(`   Current Job Status: ${job.status}`);
    console.log(`   Error Message: ${job.errorMessage || 'none'}`);
    
    try {
      // 1. Check actual Replicate status
      const training = await replicate.trainings.get(externalTrainingId);
      console.log(`   Replicate Status: ${training.status}`);
      
      let shouldUpdateJob = false;
      let newJobStatus = job.status;
      let newJobError = job.errorMessage;
      
      // 2. Fix job queue status if it doesn't match Replicate
      if (training.status === 'succeeded' && job.status !== 'succeeded') {
        console.log(`   ⚠️  Job status mismatch: DB shows "${job.status}" but Replicate shows "succeeded"`);
        shouldUpdateJob = true;
        newJobStatus = 'succeeded';
        newJobError = null;
        issuesFound++;
      } else if (training.status === 'failed' && job.status !== 'failed') {
        console.log(`   ⚠️  Job status mismatch: DB shows "${job.status}" but Replicate shows "failed"`);
        shouldUpdateJob = true;
        newJobStatus = 'failed';
        newJobError = training.error || 'Training failed on Replicate';
        issuesFound++;
      }
      
      if (shouldUpdateJob) {
        console.log(`   🔄 Updating job status: ${job.status} → ${newJobStatus}`);
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: newJobStatus,
            errorMessage: newJobError,
            completedAt: training.status === 'succeeded' ? new Date(training.completed_at) : undefined
          }
        });
        jobsFixed++;
      }
      
      // 3. Check and fix corresponding user model
      if (userModelId) {
        const userModel = await prisma.userModel.findUnique({
          where: { id: userModelId }
        });
        
        if (userModel) {
          console.log(`   📋 User Model Status: ${userModel.status}`);
          console.log(`   📋 HF Repo: ${userModel.huggingfaceRepo || 'none'}`);
          console.log(`   📋 LoRA Ready: ${userModel.loraReadyForInference}`);
          
          let shouldUpdateModel = false;
          let newModelStatus = userModel.status;
          let newHuggingfaceRepo = userModel.huggingfaceRepo;
          let newHuggingfaceStatus = userModel.huggingfaceStatus;
          let newLoraReady = userModel.loraReadyForInference;
          let newTrainingCompletedAt = userModel.trainingCompletedAt;
          
          if (training.status === 'succeeded') {
            // Training succeeded - check HuggingFace model availability
            if (userModel.huggingfaceRepo) {
              console.log(`   🔍 Checking HuggingFace model: ${userModel.huggingfaceRepo}`);
              const hfExists = await checkHuggingFaceModelExists(userModel.huggingfaceRepo);
              console.log(`   📊 HuggingFace Model Exists: ${hfExists}`);
              
              if (!hfExists && userModel.status === 'ready') {
                console.log(`   ⚠️  Model shows ready but HuggingFace model doesn't exist`);
                shouldUpdateModel = true;
                newModelStatus = 'training'; // Show as needing upload
                newHuggingfaceRepo = null;
                newHuggingfaceStatus = null;
                newLoraReady = false;
                newTrainingCompletedAt = new Date(training.completed_at);
                issuesFound++;
              } else if (hfExists && userModel.status !== 'ready') {
                console.log(`   ⚠️  HuggingFace model exists but model not marked ready`);
                shouldUpdateModel = true;
                newModelStatus = 'ready';
                newLoraReady = true;
                newHuggingfaceStatus = 'ready';
                newTrainingCompletedAt = new Date(training.completed_at);
                issuesFound++;
              }
            } else if (userModel.status === 'ready') {
              console.log(`   ⚠️  Model shows ready but no HuggingFace repo specified`);
              shouldUpdateModel = true;
              newModelStatus = 'training'; // Show as needing upload
              newLoraReady = false;
              newHuggingfaceStatus = null;
              newTrainingCompletedAt = new Date(training.completed_at);
              issuesFound++;
            } else if (userModel.status === 'failed') {
              console.log(`   ⚠️  Model shows failed but Replicate training succeeded`);
              shouldUpdateModel = true;
              newModelStatus = 'training'; // Show as needing upload
              newLoraReady = false;
              newHuggingfaceStatus = null;
              newTrainingCompletedAt = new Date(training.completed_at);
              issuesFound++;
            }
          } else if (training.status === 'failed') {
            // Training failed - make sure model reflects this
            if (userModel.status !== 'failed') {
              console.log(`   ⚠️  Model status doesn't reflect training failure`);
              shouldUpdateModel = true;
              newModelStatus = 'failed';
              newLoraReady = false;
              newHuggingfaceRepo = null;
              newHuggingfaceStatus = null;
              issuesFound++;
            }
          }
          
          if (shouldUpdateModel) {
            console.log(`   🔄 Updating model: ${userModel.status} → ${newModelStatus}`);
            if (newHuggingfaceRepo !== userModel.huggingfaceRepo) {
              console.log(`   🔄 HF Repo: ${userModel.huggingfaceRepo || 'none'} → ${newHuggingfaceRepo || 'none'}`);
            }
            
            await prisma.userModel.update({
              where: { id: userModel.id },
              data: {
                status: newModelStatus,
                huggingfaceRepo: newHuggingfaceRepo,
                huggingfaceStatus: newHuggingfaceStatus,
                loraReadyForInference: newLoraReady,
                trainingCompletedAt: newTrainingCompletedAt,
              }
            });
            modelsFixed++;
          }
        } else {
          console.log(`   ⚠️  User model ${userModelId} not found`);
        }
      }
      
      console.log(''); // Empty line for readability
      
    } catch (error) {
      console.error(`   ❌ Error checking ${externalTrainingId}:`, error.message);
      console.log('');
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('📊 CLEANUP SUMMARY:');
  console.log(`   Jobs checked: ${jobs.length}`);
  console.log(`   Issues found: ${issuesFound}`);
  console.log(`   Jobs fixed: ${jobsFixed}`);
  console.log(`   Models fixed: ${modelsFixed}`);
  
  if (jobsFixed > 0 || modelsFixed > 0) {
    console.log('\n🎉 Database cleanup completed successfully!');
    console.log('   - Job queue entries now match Replicate status');
    console.log('   - Model statuses reflect actual state');
    console.log('   - Models needing upload show as "training" status');
  } else if (issuesFound === 0) {
    console.log('\n✅ Database is clean - no inconsistencies found!');
  } else {
    console.log('\n⚠️  Some issues found but could not be fixed automatically');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error); 