const { PrismaClient } = require('../src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  console.log('🔍 Checking models with loraReadyForInference = true...\n');
  
  try {
    const models = await prisma.userModel.findMany({
      where: {
        loraReadyForInference: true
      },
      select: {
        id: true,
        name: true,
        status: true,
        huggingfaceRepo: true,
        loraReadyForInference: true,
        validationStatus: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${models.length} models with loraReadyForInference = true:\n`);
    
    if (models.length === 0) {
      console.log('✅ No models currently marked as ready for LoRA inference.');
      return;
    }
    
    models.forEach((model, index) => {
      console.log(`${index + 1}. Model: ${model.name}`);
      console.log(`   ID: ${model.id}`);
      console.log(`   Status: ${model.status}`);
      console.log(`   HuggingFace Repo: ${model.huggingfaceRepo || 'none'}`);
      console.log(`   Validation Status: ${model.validationStatus || 'unknown'}`);
      console.log(`   Created: ${model.createdAt.toISOString()}`);
      console.log('');
    });
    
    console.log('📋 Summary:');
    console.log(`   Total models: ${models.length}`);
    console.log(`   With HF repos: ${models.filter(m => m.huggingfaceRepo).length}`);
    console.log(`   Status 'ready': ${models.filter(m => m.status === 'ready').length}`);
    console.log(`   Validation 'valid': ${models.filter(m => m.validationStatus === 'valid').length}`);
    
  } catch (error) {
    console.error('❌ Error querying models:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error); 