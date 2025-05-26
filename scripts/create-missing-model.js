require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');

async function createMissingModel() {
  const prisma = new PrismaClient();
  
  const targetTrainingId = 'andamhvr2hrmc0cq0gr841nrrr';
  const expectedModelId = 'cmb2qmsdf0001shg1x7cire31';
  
  console.log(`🔧 Creating missing UserModel record for training ID: ${targetTrainingId}\n`);
  
  try {
    // 1. Get the JobQueue record to extract information
    const jobRecord = await prisma.jobQueue.findFirst({
      where: {
        payload: { path: ['externalTrainingId'], equals: targetTrainingId }
      }
    });
    
    if (!jobRecord) {
      console.log('❌ No JobQueue record found for this training ID');
      return;
    }
    
    console.log('📋 Found JobQueue record:');
    console.log(`   Job ID: ${jobRecord.id}`);
    console.log(`   Status: ${jobRecord.status}`);
    console.log(`   User Model ID from payload: ${jobRecord.payload.userModelId}`);
    
    // 2. Get user ID from existing model (assuming same user)
    const existingModel = await prisma.userModel.findFirst({
      select: { userId: true, user: { select: { email: true } } }
    });
    
    if (!existingModel) {
      console.log('❌ No existing models found to determine user ID');
      return;
    }
    
    console.log(`📋 Using user ID: ${existingModel.userId} (${existingModel.user.email})`);
    
    // 3. Prompt for missing information
    console.log('\n❓ Please provide the following information:');
    console.log('   1. Model name (e.g., "geo2", "my-model"):');
    console.log('   2. HuggingFace repository name (e.g., "username/model-name"):');
    console.log('   3. Trigger word (optional, will default to model name):');
    console.log('\n⚠️  This script will create the UserModel record with the following:');
    console.log(`   - ID: ${expectedModelId}`);
    console.log(`   - External Training ID: ${targetTrainingId}`);
    console.log(`   - User ID: ${existingModel.userId}`);
    console.log(`   - Status: ready`);
    console.log(`   - LoRA Ready: true`);
    console.log('\n💡 Edit this script to provide the model name and HuggingFace repo, then run it again.');
    
    // TODO: Replace these with actual values
    const modelName = 'REPLACE_WITH_MODEL_NAME'; // e.g., 'geo2'
    const huggingfaceRepo = 'REPLACE_WITH_HUGGINGFACE_REPO'; // e.g., 'username/model-name'
    const triggerWord = 'REPLACE_WITH_TRIGGER_WORD'; // e.g., 'geo2_person' or leave as modelName
    
    if (modelName === 'REPLACE_WITH_MODEL_NAME') {
      console.log('\n🛑 Please edit this script and replace the placeholder values before running.');
      return;
    }
    
    // 4. Create the UserModel record
    console.log('\n🔧 Creating UserModel record...');
    
    const newModel = await prisma.userModel.create({
      data: {
        id: expectedModelId,
        userId: existingModel.userId,
        name: modelName,
        status: 'ready',
        externalTrainingId: targetTrainingId,
        externalTrainingService: 'replicate',
        huggingfaceRepo: huggingfaceRepo,
        huggingfaceStatus: 'ready',
        loraReadyForInference: true,
        triggerWord: triggerWord || modelName.toLowerCase().replace(/\s+/g, '_'),
        trainingCompletedAt: new Date(jobRecord.completedAt || jobRecord.createdAt),
        createdAt: new Date(jobRecord.createdAt),
      }
    });
    
    console.log('✅ UserModel record created successfully!');
    console.log(`   Model ID: ${newModel.id}`);
    console.log(`   Name: ${newModel.name}`);
    console.log(`   Status: ${newModel.status}`);
    console.log(`   HuggingFace Repo: ${newModel.huggingfaceRepo}`);
    console.log(`   Trigger Word: ${newModel.triggerWord}`);
    
    // 5. Verify the fix worked
    console.log('\n🧪 Verifying the fix...');
    const verifyModel = await prisma.userModel.findFirst({
      where: { externalTrainingId: targetTrainingId }
    });
    
    if (verifyModel) {
      console.log('✅ Verification successful! Model can now be found by external training ID.');
      console.log('\n🎉 The re-upload issue should now be resolved!');
      console.log('   Try using the retry upload button in the dashboard.');
    } else {
      console.log('❌ Verification failed - model still not found.');
    }
    
  } catch (error) {
    console.error('❌ Error creating UserModel record:', error);
    
    if (error.code === 'P2002') {
      console.log('\n💡 This error usually means a record with this ID already exists.');
      console.log('   The model might have been created already. Check the database.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createMissingModel().catch(console.error); 