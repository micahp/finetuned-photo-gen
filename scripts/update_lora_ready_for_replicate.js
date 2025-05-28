const { PrismaClient } = require('../src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  console.log('🔄 Updating loraReadyForInference flag for Replicate compatibility...\n');
  
  try {
    // Get all models that currently have loraReadyForInference = true
    const modelsToUpdate = await prisma.userModel.findMany({
      where: {
        loraReadyForInference: true
      },
      select: {
        id: true,
        name: true,
        status: true,
        huggingfaceRepo: true,
        loraReadyForInference: true
      }
    });
    
    console.log(`Found ${modelsToUpdate.length} models currently marked as ready for LoRA inference:\n`);
    
    if (modelsToUpdate.length === 0) {
      console.log('✅ No models need updating.');
      return;
    }
    
    // Since we confirmed all models use FLUX.1-dev base model (which Replicate supports),
    // and they have HuggingFace repos, they should remain ready for inference with Replicate
    let validCount = 0;
    let invalidCount = 0;
    
    for (const model of modelsToUpdate) {
      console.log(`📦 Model: ${model.name}`);
      console.log(`   ID: ${model.id}`);
      console.log(`   Status: ${model.status}`);
      console.log(`   HF Repo: ${model.huggingfaceRepo || 'none'}`);
      
      // Check if model meets Replicate requirements:
      // 1. Status is 'ready'
      // 2. Has HuggingFace repository
      // 3. Uses FLUX.1-dev base model (which we confirmed earlier)
      
      const isValidForReplicate = model.status === 'ready' && model.huggingfaceRepo;
      
      if (isValidForReplicate) {
        console.log(`   ✅ VALID for Replicate LoRA inference`);
        validCount++;
      } else {
        console.log(`   ❌ INVALID for Replicate LoRA inference`);
        console.log(`      Reason: ${!model.huggingfaceRepo ? 'No HuggingFace repo' : 'Status not ready'}`);
        invalidCount++;
        
        // Update to false if not valid
        await prisma.userModel.update({
          where: { id: model.id },
          data: { loraReadyForInference: false }
        });
        console.log(`   🔄 Updated loraReadyForInference to false`);
      }
      
      console.log('');
    }
    
    console.log('📊 Summary:');
    console.log(`   Models valid for Replicate: ${validCount}`);
    console.log(`   Models updated to invalid: ${invalidCount}`);
    console.log(`   Total processed: ${modelsToUpdate.length}`);
    
    if (validCount > 0) {
      console.log('\n✅ SUCCESS: Your models are compatible with Replicate LoRA inference!');
      console.log('   Replicate supports FLUX.1-dev base models and can use HuggingFace repositories.');
      console.log('   The generation API will now use Replicate for custom model inference.');
    }
    
    if (invalidCount > 0) {
      console.log(`\n⚠️  ${invalidCount} models were marked as not ready for inference.`);
      console.log('   These models need to have status="ready" and a valid HuggingFace repository.');
    }
    
  } catch (error) {
    console.error('❌ Error updating models:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error); 