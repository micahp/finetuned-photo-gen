/**
 * Script to diagnose and fix upload detection issues for specific training jobs
 * This addresses cases where HuggingFace uploads were successful but the system doesn't detect them
 */

const { PrismaClient } = require('../src/generated/prisma');
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

async function findHuggingFaceModelByPattern(username, modelNamePattern) {
  try {
    // Try common naming patterns for the model
    const patterns = [
      `${username}/${modelNamePattern}`,
      `${username}/flux-lora-${modelNamePattern}`,
      `${username}/${modelNamePattern}-lora`,
      `${username}/flux-${modelNamePattern}`,
    ];
    
    for (const pattern of patterns) {
      console.log(`🔍 Checking pattern: ${pattern}`);
      const exists = await checkHuggingFaceModelExists(pattern);
      if (exists) {
        console.log(`✅ Found model: ${pattern}`);
        return pattern;
      }
    }
    
    // Try with timestamp patterns (common in our system)
    const timestampPatterns = [
      `${username}/${modelNamePattern}-\\d+-\\w+`,
      `${username}/flux-lora-${modelNamePattern}-\\d+-\\w+`,
    ];
    
    console.log(`🔍 Searching HuggingFace for models matching patterns...`);
    // Note: This would require HuggingFace API search, which is limited
    // For now, we'll rely on database records and manual verification
    
    return null;
  } catch (error) {
    console.error('Error searching for HuggingFace model:', error);
    return null;
  }
}

async function fixUploadDetection(trainingId, expectedModelName) {
  const prisma = new PrismaClient();
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  console.log(`🔧 Diagnosing upload detection for training: ${trainingId}`);
  console.log(`📋 Expected model name: ${expectedModelName}`);
  
  try {
    // 1. Check Replicate training status
    console.log('\n📊 STEP 1: Checking Replicate training status...');
    const training = await replicate.trainings.get(trainingId);
    console.log(`   Replicate Status: ${training.status}`);
    console.log(`   Completed At: ${training.completed_at || 'N/A'}`);
    console.log(`   Output: ${training.output ? 'Available' : 'None'}`);
    
    if (training.status !== 'succeeded') {
      console.log(`❌ Training did not succeed. Status: ${training.status}`);
      if (training.error) {
        console.log(`   Error: ${training.error}`);
      }
      return;
    }
    
    // 2. Check database model record
    console.log('\n📊 STEP 2: Checking database model record...');
    const model = await prisma.userModel.findFirst({
      where: {
        externalTrainingId: trainingId
      },
      include: {
        user: {
          select: { email: true, name: true }
        }
      }
    });
    
    if (!model) {
      console.log(`❌ No model found in database with training ID: ${trainingId}`);
      return;
    }
    
    console.log(`   Model ID: ${model.id}`);
    console.log(`   Model Name: ${model.name}`);
    console.log(`   Status: ${model.status}`);
    console.log(`   HuggingFace Repo: ${model.huggingfaceRepo || 'None'}`);
    console.log(`   LoRA Ready: ${model.loraReadyForInference}`);
    console.log(`   User: ${model.user.email}`);
    
    // 3. Check if HuggingFace model exists
    console.log('\n📊 STEP 3: Checking HuggingFace model existence...');
    let actualHuggingFaceRepo = null;
    
    if (model.huggingfaceRepo) {
      console.log(`   Checking recorded repo: ${model.huggingfaceRepo}`);
      const exists = await checkHuggingFaceModelExists(model.huggingfaceRepo);
      if (exists) {
        console.log(`   ✅ Model exists at recorded location`);
        actualHuggingFaceRepo = model.huggingfaceRepo;
      } else {
        console.log(`   ❌ Model not found at recorded location`);
      }
    }
    
    if (!actualHuggingFaceRepo) {
      console.log(`   🔍 Searching for model with different naming patterns...`);
      // Extract username from user email or use a default pattern
      const username = model.user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      actualHuggingFaceRepo = await findHuggingFaceModelByPattern(username, model.name);
    }
    
    // 4. Determine what needs to be fixed
    console.log('\n📊 STEP 4: Determining required fixes...');
    let needsUpdate = false;
    let newStatus = model.status;
    let newHuggingfaceRepo = model.huggingfaceRepo;
    let newHuggingfaceStatus = model.huggingfaceStatus;
    let newLoraReady = model.loraReadyForInference;
    let newTrainingCompletedAt = model.trainingCompletedAt;
    
    if (actualHuggingFaceRepo) {
      // Model exists on HuggingFace
      if (model.status !== 'ready') {
        console.log(`   🔧 Model exists but status is '${model.status}', should be 'ready'`);
        needsUpdate = true;
        newStatus = 'ready';
        newLoraReady = true;
        newHuggingfaceStatus = 'ready';
        newTrainingCompletedAt = new Date(training.completed_at);
      }
      
      if (model.huggingfaceRepo !== actualHuggingFaceRepo) {
        console.log(`   🔧 Updating HuggingFace repo: ${model.huggingfaceRepo || 'none'} → ${actualHuggingFaceRepo}`);
        needsUpdate = true;
        newHuggingfaceRepo = actualHuggingFaceRepo;
      }
      
      if (!needsUpdate) {
        console.log(`   ✅ Model is correctly configured`);
      }
    } else {
      // Model doesn't exist on HuggingFace
      if (model.status === 'ready') {
        console.log(`   🔧 Model shows ready but doesn't exist on HuggingFace`);
        needsUpdate = true;
        newStatus = 'training'; // Show as needing upload
        newLoraReady = false;
        newHuggingfaceRepo = null;
        newHuggingfaceStatus = null;
        newTrainingCompletedAt = new Date(training.completed_at);
      } else {
        console.log(`   ℹ️  Model needs to be uploaded to HuggingFace`);
      }
    }
    
    // 5. Apply fixes if needed
    if (needsUpdate) {
      console.log('\n📊 STEP 5: Applying fixes...');
      console.log(`   Updating status: ${model.status} → ${newStatus}`);
      
      await prisma.userModel.update({
        where: { id: model.id },
        data: {
          status: newStatus,
          huggingfaceRepo: newHuggingfaceRepo,
          huggingfaceStatus: newHuggingfaceStatus,
          loraReadyForInference: newLoraReady,
          trainingCompletedAt: newTrainingCompletedAt,
        }
      });
      
      console.log(`   ✅ Model updated successfully`);
      
      if (actualHuggingFaceRepo) {
        console.log(`\n🎉 SUCCESS: Upload detection fixed!`);
        console.log(`   Model: ${model.name}`);
        console.log(`   Status: ready`);
        console.log(`   HuggingFace: https://huggingface.co/${actualHuggingFaceRepo}`);
      } else {
        console.log(`\n⚠️  Model training succeeded but needs HuggingFace upload`);
        console.log(`   Use the retry upload button in the dashboard to upload the model`);
      }
    } else {
      console.log('\n✅ No fixes needed - model is correctly configured');
    }
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node scripts/fix-upload-detection.js <training-id> [expected-model-name]');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/fix-upload-detection.js r7y4cc09kdrma0cq0hz8jnr50g geo');
    console.log('');
    process.exit(1);
  }
  
  const trainingId = args[0];
  const expectedModelName = args[1] || 'unknown';
  
  await fixUploadDetection(trainingId, expectedModelName);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fixUploadDetection, checkHuggingFaceModelExists }; 