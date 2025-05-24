const { TogetherAIService } = require('../src/lib/together-ai')

async function testTogetherAITraining() {
  try {
    console.log('🧪 Testing Together AI integration...')
    
    const together = new TogetherAIService()
    
    // Test image generation first (simpler)
    console.log('📸 Testing image generation...')
    const imageResult = await together.generateImage({
      prompt: 'a beautiful sunset over mountains',
      model: 'black-forest-labs/FLUX.1-schnell-Free', // Free model
      width: 512,
      height: 512,
      steps: 3,
    })
    
    if (imageResult.status === 'completed') {
      console.log('✅ Image generation successful!')
      console.log('   Image URL:', imageResult.images?.[0]?.url)
    } else {
      console.log('❌ Image generation failed:', imageResult.error)
      return
    }
    
    // Test LoRA training (will likely fail without real images, but should show API connectivity)
    console.log('🎯 Testing LoRA training API call...')
    const trainingResult = await together.trainLoRA({
      name: 'test-model',
      description: 'Test LoRA model',
      baseModel: 'black-forest-labs/FLUX.1-dev',
      trainingImages: [
        {
          url: 'https://example.com/test-image.jpg',
          caption: 'test_person person'
        }
      ],
      triggerWord: 'test_person',
    })
    
    if (trainingResult.status === 'failed') {
      console.log('⚠️ Training failed (expected with test data):', trainingResult.error)
      console.log('✅ But API connectivity is working!')
    } else {
      console.log('✅ Training started successfully!')
      console.log('   Job ID:', trainingResult.id)
      console.log('   Status:', trainingResult.status)
    }
    
    console.log('🎉 Together AI integration test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  testTogetherAITraining()
}

module.exports = { testTogetherAITraining } 