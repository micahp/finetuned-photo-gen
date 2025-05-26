require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');

async function createMissingModelProper() {
  const prisma = new PrismaClient();
  
  const targetTrainingId = 'andamhvr2hrmc0cq0gr841nrrr';
  const expectedModelId = 'cmb2qmsdf0001shg1x7cire31';
  
  console.log(`🔧 Creating missing UserModel record following normal upload logic\n`);
  console.log(`Training ID: ${targetTrainingId}`);
  console.log(`Expected Model ID: ${expectedModelId}\n`);
  
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
    console.log(`   Created: ${jobRecord.createdAt}`);
    console.log(`   Completed: ${jobRecord.completedAt}`);
    
    // 2. Get user ID from existing model (assuming same user)
    const existingModel = await prisma.userModel.findFirst({
      select: { userId: true, user: { select: { email: true } } }
    });
    
    if (!existingModel) {
      console.log('❌ No existing models found to determine user ID');
      return;
    }
    
    console.log(`📋 Using user ID: ${existingModel.userId} (${existingModel.user.email})`);
    
    // 3. Create the UserModel record with status 'uploading' to match normal flow
    // This follows the same pattern as when training completes but upload hasn't started yet
    console.log('\n🔧 Creating UserModel record with "uploading" status...');
    console.log('   This matches the normal flow when training completes but HuggingFace upload is pending');
    
    const newModel = await prisma.userModel.create({
      data: {
        id: expectedModelId,
        userId: existingModel.userId,
        name: 'geo2', // Based on your existing model pattern
        status: 'uploading', // This allows the retry upload button to appear
        externalTrainingId: targetTrainingId,
        externalTrainingService: 'replicate',
        huggingfaceRepo: null, // No repo yet - will be set during upload
        huggingfaceStatus: null, // No status yet
        loraReadyForInference: false, // Not ready until upload completes
        triggerWord: 'geo2_person', // Following the pattern from your existing model
        trainingStartedAt: new Date(jobRecord.createdAt),
        trainingCompletedAt: new Date(jobRecord.completedAt || jobRecord.createdAt),
        createdAt: new Date(jobRecord.createdAt),
      }
    });
    
    console.log('✅ UserModel record created successfully!');
    console.log(`   Model ID: ${newModel.id}`);
    console.log(`   Name: ${newModel.name}`);
    console.log(`   Status: ${newModel.status}`);
    console.log(`   External Training ID: ${newModel.externalTrainingId}`);
    console.log(`   Trigger Word: ${newModel.triggerWord}`);
    console.log(`   HuggingFace Repo: ${newModel.huggingfaceRepo || 'none (will be set during upload)'}`);
    
    // 4. Verify the fix worked
    console.log('\n🧪 Verifying the fix...');
    const verifyModel = await prisma.userModel.findFirst({
      where: { externalTrainingId: targetTrainingId }
    });
    
    if (verifyModel) {
      console.log('✅ Verification successful! Model can now be found by external training ID.');
      console.log('\n🎉 The model is now ready for the retry upload process!');
      console.log('\nNext steps:');
      console.log('1. Go to your dashboard');
      console.log('2. Find the "geo2" model');
      console.log('3. Click the "Upload to HuggingFace" or retry upload button');
      console.log('4. The system will follow the normal upload logic and create a HuggingFace repo');
      console.log('\n💡 The system will automatically generate a unique repository name like:');
      console.log('   geoppls/geo2-[timestamp]-[random]');
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

createMissingModelProper().catch(console.error); 