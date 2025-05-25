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
  
  console.log('🔍 Comprehensive Database Consistency Check...\n');
  
  // Find all models with external training IDs
  const models = await prisma.userModel.findMany({
    where: {
      externalTrainingId: { not: null },
      externalTrainingService: 'replicate'
    },
    include: {
      user: { select: { id: true, email: true } }
    }
  });
  
  console.log(`Found ${models.length} models with external training IDs\n`);
  
  let fixedCount = 0;
  let issuesFound = 0;
  
  for (const model of models) {
    console.log(`📋 Checking model: ${model.name} (${model.id})`);
    console.log(`   Current Status: ${model.status}`);
    console.log(`   External Training ID: ${model.externalTrainingId}`);
    console.log(`   HuggingFace Repo: ${model.huggingfaceRepo || 'none'}`);
    console.log(`   LoRA Ready: ${model.loraReadyForInference}`);
    
    let hasIssues = false;
    let shouldUpdate = false;
    let newStatus = model.status;
    let newHuggingfaceRepo = model.huggingfaceRepo;
    let newHuggingfaceStatus = model.huggingfaceStatus;
    let newLoraReady = model.loraReadyForInference;
    let newTrainingCompletedAt = model.trainingCompletedAt;
    let issues = [];
    
    try {
      // 1. Check actual Replicate status
      const training = await replicate.trainings.get(model.externalTrainingId);
      console.log(`   Replicate Status: ${training.status}`);
      
      // 2. Check if database status matches Replicate status
      if (training.status === 'succeeded' && model.status === 'failed') {
        issues.push('Database shows failed but Replicate succeeded');
        hasIssues = true;
      } else if (training.status === 'failed' && model.status !== 'failed') {
        issues.push('Database shows success but Replicate failed');
        hasIssues = true;
      }
      
      // 3. If Replicate succeeded, check HuggingFace model availability
      if (training.status === 'succeeded') {
        if (model.huggingfaceRepo) {
          console.log(`   Checking HuggingFace model: ${model.huggingfaceRepo}`);
          const hfExists = await checkHuggingFaceModelExists(model.huggingfaceRepo);
          console.log(`   HuggingFace Model Exists: ${hfExists}`);
          
          if (!hfExists && model.status === 'ready') {
            issues.push('Database says model is ready but HuggingFace model does not exist');
            hasIssues = true;
            shouldUpdate = true;
            
            // Set status to indicate training succeeded but needs re-upload
            newStatus = 'training'; // This will show in the dashboard as needing action
            newHuggingfaceRepo = null;
            newHuggingfaceStatus = null;
            newLoraReady = false;
            newTrainingCompletedAt = model.trainingCompletedAt; // Keep the training completion date
          } else if (hfExists && model.status !== 'ready') {
            issues.push('HuggingFace model exists but database does not show ready');
            hasIssues = true;
            shouldUpdate = true;
            newStatus = 'ready';
            newLoraReady = true;
            newHuggingfaceStatus = 'ready';
            newTrainingCompletedAt = new Date(training.completed_at);
          }
        } else if (model.status === 'ready') {
          // Model shows ready but no HuggingFace repo set
          issues.push('Model status is ready but no HuggingFace repo specified');
          hasIssues = true;
          shouldUpdate = true;
          newStatus = 'training'; // Needs upload
          newLoraReady = false;
          newHuggingfaceStatus = null;
        }
        
        // If training succeeded but model shows as failed, fix it
        if (training.status === 'succeeded' && model.status === 'failed') {
          shouldUpdate = true;
          newStatus = 'training'; // Show as needing upload
          newLoraReady = false;
          newTrainingCompletedAt = new Date(training.completed_at);
          
          // Clear HuggingFace info since we know it doesn't exist
          newHuggingfaceRepo = null;
          newHuggingfaceStatus = null;
        }
      } else if (training.status === 'failed') {
        // Training failed - make sure database reflects this
        if (model.status !== 'failed') {
          shouldUpdate = true;
          newStatus = 'failed';
          newLoraReady = false;
          newHuggingfaceRepo = null;
          newHuggingfaceStatus = null;
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Error checking model ${model.id}:`, error.message);
      issues.push(`API error: ${error.message}`);
      hasIssues = true;
    }
    
    if (hasIssues) {
      issuesFound++;
      console.log(`   ⚠️  ISSUES FOUND:`);
      issues.forEach(issue => console.log(`      - ${issue}`));
    }
    
    if (shouldUpdate) {
      console.log(`   🔄 FIXING: Updating model status: ${model.status} → ${newStatus}`);
      if (newHuggingfaceRepo !== model.huggingfaceRepo) {
        console.log(`   🔄 FIXING: HuggingFace repo: ${model.huggingfaceRepo || 'none'} → ${newHuggingfaceRepo || 'none'}`);
      }
      
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
      
      fixedCount++;
      console.log(`   ✅ Model updated successfully`);
    } else if (!hasIssues) {
      console.log(`   ✅ Model is consistent`);
    } else {
      console.log(`   ⏭️  Issues found but no automatic fix applied`);
    }
    
    console.log(''); // Empty line for readability
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('📊 SUMMARY:');
  console.log(`   Models checked: ${models.length}`);
  console.log(`   Issues found: ${issuesFound}`);
  console.log(`   Models fixed: ${fixedCount}`);
  
  if (fixedCount > 0) {
    console.log('\n🎉 Database inconsistencies have been fixed!');
    console.log('   Models that need re-upload will show as "training" status');
    console.log('   Use the retry upload button in the dashboard to upload to HuggingFace');
  } else if (issuesFound === 0) {
    console.log('\n✅ No inconsistencies found - database is clean!');
  } else {
    console.log('\n⚠️  Some issues found but could not be automatically fixed');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error); 