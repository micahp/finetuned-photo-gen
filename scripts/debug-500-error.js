require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');
const Replicate = require('replicate');

async function debug500Error() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🐛 Debugging 500 Error for Training Job\n');
  
  const testTrainingId = 'andamhvr2hrmc0cq0gr841nrrr';
  
  try {
    console.log('1️⃣ Checking Job Queue...');
    const job = await prisma.jobQueue.findFirst({
      where: {
        jobType: 'model_training',
        payload: {
          path: ['externalTrainingId'],
          equals: testTrainingId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!job) {
      console.log('❌ Job not found in queue');
      return;
    }
    
    console.log('✅ Job found:', {
      id: job.id,
      status: job.status,
      userId: job.userId,
      errorMessage: job.errorMessage
    });
    
    console.log('\n2️⃣ Checking User Model...');
    const userModel = await prisma.userModel.findFirst({
      where: { externalTrainingId: testTrainingId }
    });
    
    if (!userModel) {
      console.log('❌ User model not found');
    } else {
      console.log('✅ User model found:', {
        id: userModel.id,
        status: userModel.status,
        huggingfaceRepo: userModel.huggingfaceRepo,
        loraReadyForInference: userModel.loraReadyForInference
      });
    }
    
    console.log('\n3️⃣ Checking Replicate Status...');
    let replicateStatus;
    try {
      const training = await replicate.trainings.get(testTrainingId);
      replicateStatus = {
        status: training.status,
        error: training.error,
        logs: training.logs ? training.logs.substring(0, 200) + '...' : null
      };
      console.log('✅ Replicate status:', replicateStatus.status);
    } catch (error) {
      console.log('❌ Replicate error:', error.message);
      replicateStatus = {
        status: 'unknown',
        error: error.message
      };
    }
    
    console.log('\n4️⃣ Simulating API Logic...');
    
    // Check if this matches the API logic that might be failing
    const payload = job.payload;
    
    console.log('Payload external training ID:', payload?.externalTrainingId);
    console.log('Job status:', job.status);
    console.log('Job includes running/pending/succeeded/completed:', ['running', 'pending', 'succeeded', 'completed'].includes(job.status));
    
    if (payload?.externalTrainingId && ['running', 'pending', 'succeeded', 'completed'].includes(job.status)) {
      console.log('✅ Should attempt unified status resolution');
      
      // Build status sources like the API does
      const sources = {
        jobQueue: {
          status: job.status,
          errorMessage: job.errorMessage,
          completedAt: job.completedAt
        },
        replicate: replicateStatus,
        userModel: {
          status: userModel?.status || 'unknown',
          huggingfaceRepo: userModel?.huggingfaceRepo,
          loraReadyForInference: userModel?.loraReadyForInference || false,
          trainingCompletedAt: userModel?.trainingCompletedAt
        }
      };
      
      console.log('\n📊 Status Sources:');
      console.log(JSON.stringify(sources, null, 2));
      
      // The error might be in the TrainingStatusResolver.resolveStatus call
      console.log('\n⚠️  The 500 error is likely happening in TrainingStatusResolver.resolveStatus()');
      console.log('   This is a TypeScript module that can\'t be imported directly in Node.js');
      console.log('   The error might be:');
      console.log('   - Missing or invalid data in the sources');
      console.log('   - Error in the unified status resolution logic');
      console.log('   - Issue with the Replicate API response format');
      
    } else {
      console.log('❌ Would not attempt unified status resolution');
    }
    
    console.log('\n5️⃣ Checking for potential issues...');
    
    // Check for common issues
    if (!process.env.REPLICATE_API_TOKEN) {
      console.log('❌ REPLICATE_API_TOKEN not found in environment');
    } else {
      console.log('✅ REPLICATE_API_TOKEN is set');
    }
    
    if (replicateStatus.status === 'unknown') {
      console.log('❌ Replicate API call failed - this could cause 500 error');
    }
    
    if (!userModel) {
      console.log('❌ Missing user model - this could cause issues in status resolution');
    }
    
    console.log('\n💡 To fix the 500 error:');
    console.log('1. Check the server logs for the exact error message');
    console.log('2. The error is likely in the TrainingStatusResolver.resolveStatus() method');
    console.log('3. Add try-catch blocks around the unified status resolution');
    console.log('4. Check if the Replicate API is accessible and returning valid data');
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debug500Error().catch(console.error); 