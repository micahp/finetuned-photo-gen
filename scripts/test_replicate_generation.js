const { ReplicateService } = require('../src/lib/replicate-service');
const { PrismaClient } = require('../src/generated/prisma');

async function testReplicateGeneration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧪 Testing Replicate LoRA generation...\n');
    
    // Get one of our ready models
    const testModel = await prisma.userModel.findFirst({
      where: {
        loraReadyForInference: true,
        status: 'ready',
        huggingfaceRepo: { not: null }
      },
      select: {
        id: true,
        name: true,
        huggingfaceRepo: true,
        triggerWord: true
      }
    });
    
    if (!testModel) {
      console.log('❌ No ready models found for testing');
      return;
    }
    
    console.log('📦 Using test model:', {
      name: testModel.name,
      huggingfaceRepo: testModel.huggingfaceRepo,
      triggerWord: testModel.triggerWord
    });
    
    // Initialize Replicate service
    const replicate = new ReplicateService();
    
    // Test generation with minimal parameters
    console.log('\n🎨 Starting test generation...');
    const result = await replicate.generateWithLoRA({
      prompt: 'a professional headshot',
      loraPath: testModel.huggingfaceRepo,
      triggerWord: testModel.triggerWord,
      width: 512,
      height: 512,
      steps: 4, // Minimal steps for quick test
      seed: 12345
    });
    
    console.log('\n📊 Generation result:', {
      id: result.id,
      status: result.status,
      hasImages: !!result.images?.length,
      error: result.error
    });
    
    if (result.status === 'completed' && result.images?.length) {
      console.log('✅ SUCCESS: Replicate LoRA generation works!');
      console.log(`   Generated image URL: ${result.images[0].url}`);
      console.log(`   Image dimensions: ${result.images[0].width}x${result.images[0].height}`);
    } else if (result.status === 'failed') {
      console.log('❌ FAILED: Generation failed');
      console.log(`   Error: ${result.error}`);
    } else {
      console.log('⏳ PROCESSING: Generation is still in progress');
      console.log('   This is normal for Replicate - the actual API would handle async results');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Make sure REPLICATE_API_TOKEN is set in your environment');
  } finally {
    await prisma.$disconnect();
  }
}

testReplicateGeneration(); 