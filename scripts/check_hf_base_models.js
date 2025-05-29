const { PrismaClient } = require('../src/generated/prisma');

async function checkHuggingFaceBaseModel(repoId) {
  try {
    const url = `https://huggingface.co/${repoId}/raw/main/adapter_config.json`;
    console.log(`   🔍 Checking: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`   ❌ Failed to fetch adapter_config.json: ${response.status}`);
      return null;
    }
    
    const config = await response.json();
    console.log(`   📄 Base model: ${config.base_model || 'not specified'}`);
    
    return {
      baseModel: config.base_model,
      config: config
    };
  } catch (error) {
    console.log(`   ❌ Error checking ${repoId}:`, error.message);
    return null;
  }
}

async function main() {
  const prisma = new PrismaClient();
  
  console.log('🔍 Checking base models in HuggingFace repositories...\n');
  
  try {
    const models = await prisma.userModel.findMany({
      where: {
        loraReadyForInference: true,
        huggingfaceRepo: { not: null }
      },
      select: {
        id: true,
        name: true,
        huggingfaceRepo: true
      }
    });
    
    console.log(`Found ${models.length} models to check:\n`);
    
    const togetherAISupportedBaseModels = [
      'meta-llama/Meta-Llama-3.1-8B-Instruct',
      'meta-llama/Meta-Llama-3.1-70B-Instruct',
      'Qwen/Qwen2.5-14B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct'
    ];
    
    let compatibleCount = 0;
    let incompatibleCount = 0;
    let errorCount = 0;
    
    for (const model of models) {
      console.log(`📦 Model: ${model.name}`);
      console.log(`   HF Repo: ${model.huggingfaceRepo}`);
      
      const result = await checkHuggingFaceBaseModel(model.huggingfaceRepo);
      
      if (result) {
        const isCompatible = togetherAISupportedBaseModels.includes(result.baseModel);
        if (isCompatible) {
          console.log(`   ✅ COMPATIBLE with Together AI Serverless LoRA Inference`);
          compatibleCount++;
        } else {
          console.log(`   ❌ INCOMPATIBLE with Together AI Serverless LoRA Inference`);
          console.log(`   📋 Supported base models: ${togetherAISupportedBaseModels.join(', ')}`);
          incompatibleCount++;
        }
      } else {
        console.log(`   ⚠️  Could not determine base model`);
        errorCount++;
      }
      
      console.log('');
      
      // Small delay to be respectful to HuggingFace
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('📊 Summary:');
    console.log(`   Compatible models: ${compatibleCount}`);
    console.log(`   Incompatible models: ${incompatibleCount}`);
    console.log(`   Errors/Unknown: ${errorCount}`);
    console.log(`   Total checked: ${models.length}`);
    
    if (incompatibleCount > 0) {
      console.log('\n⚠️  RECOMMENDATION:');
      console.log('   Models with incompatible base models should have loraReadyForInference set to false');
      console.log('   for accurate compatibility with Together AI Serverless LoRA Inference.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error); 