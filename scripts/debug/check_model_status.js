const { PrismaClient } = require('../../src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  console.log('=== Checking Updated Model ===');
  const model = await prisma.userModel.findFirst({
    where: { 
      name: 'geo2',
      // externalTrainingId: 'r7y4cc09kdrma0cq0hz8jnr50g' // Comment out or remove if not needed for 'geo2'
    }
  });
  
  if (model) {
    console.log(`Model ${model.id}:`);
    console.log(`  Name: ${model.name}`);
    console.log(`  Status: ${model.status}`);
    console.log(`  External Training ID: ${model.externalTrainingId || 'none'}`);
    console.log(`  Service: ${model.externalTrainingService || 'none'}`);
    console.log(`  HF Repo: ${model.huggingfaceRepo || 'none'}`);
    console.log(`  HF Status: ${model.huggingfaceStatus || 'none'}`);
    console.log(`  LoRA Ready: ${model.loraReadyForInference}`);
    console.log(`  Training Completed: ${model.trainingCompletedAt || 'none'}`);
    console.log(`  Created: ${model.createdAt}`);
    console.log(`  Validation Status: ${model.validationStatus || 'none'}`);
    console.log(`  Validation Error Type: ${model.validationErrorType || 'none'}`);
    console.log(`  Validation Error: ${model.validationError || 'none'}`);
    console.log(`  Last Validation Check: ${model.lastValidationCheck || 'none'}`);
  } else {
    console.log('Model "geo2" not found');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error); 