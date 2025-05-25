require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');
const Replicate = require('replicate');

async function main() {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log('🔍 Finding models with status inconsistencies...');
  
  // Find user models that have external training IDs but wrong status
  const models = await prisma.userModel.findMany({
    where: {
      externalTrainingId: { not: null },
      externalTrainingService: 'replicate'
    },
    include: {
      user: { select: { id: true, email: true } }
    }
  });
  
  console.log(`Found ${models.length} models with external training IDs`);
  
  for (const model of models) {
    console.log(`\n📋 Checking model: ${model.name} (${model.id})`);
    console.log(`   Current Status: ${model.status}`);
    console.log(`   External ID: ${model.externalTrainingId}`);
    
    try {
      // Check actual Replicate status
      const training = await replicate.trainings.get(model.externalTrainingId);
      console.log(`   Replicate Status: ${training.status}`);
      
      let shouldUpdate = false;
      let newStatus = model.status;
      let newHuggingfaceRepo = model.huggingfaceRepo;
      let newLoraReady = model.loraReadyForInference;
      let newTrainingCompletedAt = model.trainingCompletedAt;
      
      // Check if we need to update based on Replicate status
      if (training.status === 'succeeded' && model.status === 'failed') {
        console.log(`   ⚠️  STATUS MISMATCH: Replicate succeeded but model shows failed`);
        shouldUpdate = true;
        newStatus = 'ready'; // Model is ready for use
        newLoraReady = true;
        newTrainingCompletedAt = new Date(training.completed_at);
        
        // Check if there's a model version we can use
        if (training.output && training.output.version) {
          // Extract the repo name from the version
          const versionParts = training.output.version.split(':');
          if (versionParts.length > 0) {
            newHuggingfaceRepo = versionParts[0]; // e.g., "micahp/flux-lora-geo-1748127057438-u29xpk"
          }
        }
      } else if (training.status === 'failed' && model.status !== 'failed') {
        console.log(`   ⚠️  STATUS MISMATCH: Replicate failed but model shows ${model.status}`);
        shouldUpdate = true;
        newStatus = 'failed';
        newLoraReady = false;
      } else {
        console.log(`   ✅ Status is consistent`);
      }
      
      if (shouldUpdate) {
        console.log(`   🔄 Updating model status: ${model.status} → ${newStatus}`);
        if (newHuggingfaceRepo && newHuggingfaceRepo !== model.huggingfaceRepo) {
          console.log(`   🔄 Setting HuggingFace repo: ${newHuggingfaceRepo}`);
        }
        
        await prisma.userModel.update({
          where: { id: model.id },
          data: {
            status: newStatus,
            huggingfaceRepo: newHuggingfaceRepo,
            loraReadyForInference: newLoraReady,
            trainingCompletedAt: newTrainingCompletedAt,
            huggingfaceStatus: newStatus === 'ready' ? 'ready' : null
          }
        });
        
        console.log(`   ✅ Model updated successfully`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error checking model ${model.id}:`, error.message);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🎉 Database status cleanup completed!');
  await prisma.$disconnect();
}

main().catch(console.error); 