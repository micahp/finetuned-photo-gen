const { PrismaClient } = require('./src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  console.log('=== Checking Updated Model ===');
  const model = await prisma.userModel.findFirst({
    where: { 
      name: 'geo',
      externalTrainingId: 'r7y4cc09kdrma0cq0hz8jnr50g'
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
  } else {
    console.log('Model not found');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error); 