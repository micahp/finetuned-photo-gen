const { TogetherAIService } = require('./src/lib/together-ai');

async function testCustomModelGeneration() {
  try {
    console.log('🧪 Testing custom model generation...');
    
    // Initialize the service
    const together = new TogetherAIService();
    
    // Test parameters based on the geo model we found
    const testParams = {
      prompt: 'a professional headshot in a modern office setting',
      loraPath: 'geoppls/geo-1748133826702-np1tbn',
      triggerWord: 'geo',
      aspectRatio: '1:1',
      steps: 28,
      seed: 12345
    };
    
    console.log('📋 Test parameters:', JSON.stringify(testParams, null, 2));
    
    // Test the generateWithLoRA method
    console.log('🚀 Generating image with LoRA...');
    const result = await together.generateWithLoRA(testParams);
    
    console.log('✅ Generation result:', JSON.stringify(result, null, 2));
    
    if (result.status === 'completed') {
      console.log('🎉 Success! Image generated successfully');
      console.log('🖼️ Image URL:', result.images?.[0]?.url);
    } else {
      console.log('❌ Generation failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testCustomModelGeneration(); 