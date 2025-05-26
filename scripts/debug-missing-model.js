require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');

async function debugMissingModel() {
  const prisma = new PrismaClient();
  
  const targetTrainingId = 'andamhvr2hrmc0cq0gr841nrrr';
  
  console.log(`🔍 Debugging missing model for training ID: ${targetTrainingId}\n`);
  
  try {
    // 1. Check if ANY UserModel records exist
    console.log('📊 STEP 1: Checking all UserModel records...');
    const allModels = await prisma.userModel.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        externalTrainingId: true,
        huggingfaceRepo: true,
        userId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   Found ${allModels.length} total UserModel records:`);
    allModels.forEach((model, index) => {
      console.log(`   ${index + 1}. ${model.name} (${model.id})`);
      console.log(`      Status: ${model.status}`);
      console.log(`      External Training ID: ${model.externalTrainingId || 'none'}`);
      console.log(`      HuggingFace Repo: ${model.huggingfaceRepo || 'none'}`);
      console.log(`      Created: ${model.createdAt}`);
      console.log('');
    });
    
    // 2. Check JobQueue for this training ID
    console.log('📊 STEP 2: Checking JobQueue records...');
    const jobRecords = await prisma.jobQueue.findMany({
      where: {
        OR: [
          { payload: { path: ['externalTrainingId'], equals: targetTrainingId } },
          { payload: { path: ['trainingId'], equals: targetTrainingId } },
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   Found ${jobRecords.length} job records for training ID ${targetTrainingId}:`);
    jobRecords.forEach((job, index) => {
      console.log(`   ${index + 1}. Job ${job.id}`);
      console.log(`      Status: ${job.status}`);
      console.log(`      Type: ${job.jobType}`);
      console.log(`      Created: ${job.createdAt}`);
      console.log(`      Payload:`, JSON.stringify(job.payload, null, 6));
      console.log('');
    });
    
    // 3. Check if there's a model with a similar external training ID
    console.log('📊 STEP 3: Checking for similar external training IDs...');
    const modelsWithExternalIds = await prisma.userModel.findMany({
      where: {
        externalTrainingId: { not: null }
      },
      select: {
        id: true,
        name: true,
        externalTrainingId: true,
        status: true,
      }
    });
    
    console.log(`   Found ${modelsWithExternalIds.length} models with external training IDs:`);
    modelsWithExternalIds.forEach((model, index) => {
      console.log(`   ${index + 1}. ${model.name}: ${model.externalTrainingId} (${model.status})`);
    });
    
    // 4. Suggest next steps
    console.log('\n📊 STEP 4: Analysis and Recommendations...');
    
    const hasMatchingModel = allModels.some(m => m.externalTrainingId === targetTrainingId);
    const hasJobRecord = jobRecords.length > 0;
    
    if (!hasMatchingModel && !hasJobRecord) {
      console.log('❌ ISSUE: No UserModel record AND no JobQueue record found');
      console.log('   This suggests the training was initiated outside the normal flow');
      console.log('   or the database records were lost/corrupted.');
      console.log('');
      console.log('💡 SOLUTION: You need to create a UserModel record manually');
      console.log('   linking this training ID to your HuggingFace model.');
    } else if (!hasMatchingModel && hasJobRecord) {
      console.log('❌ ISSUE: JobQueue record exists but no UserModel record');
      console.log('   This suggests the UserModel creation failed or was interrupted');
      console.log('');
      console.log('💡 SOLUTION: Create UserModel record based on JobQueue payload');
    } else if (hasMatchingModel) {
      console.log('✅ UserModel record exists - this should not happen based on earlier tests');
    }
    
  } catch (error) {
    console.error('❌ Error during investigation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMissingModel().catch(console.error); 