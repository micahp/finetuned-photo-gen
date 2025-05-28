require('dotenv').config()
const { PrismaClient } = require('../src/generated/prisma')
const { ReplicateService } = require('../src/lib/replicate-service')

async function testDirectReplicateGeneration() {
  const prisma = new PrismaClient()
  const replicate = new ReplicateService()
  
  try {
    console.log('🧪 Testing direct Replicate generation...\n')
    
    // Get one of the ready models
    const testModel = await prisma.userModel.findFirst({
      where: {
        replicateModelId: { not: null },
        status: 'ready',
        loraReadyForInference: true
      }
    })
    
    if (!testModel) {
      console.log('❌ No models available for testing')
      return
    }
    
    console.log(`📋 Testing with model: ${testModel.name}`)
    console.log(`   Replicate Model ID: ${testModel.replicateModelId}`)
    console.log(`   Trigger Word: ${testModel.triggerWord}`)
    console.log()
    
    // Test the new generateWithTrainedModel method
    console.log('🎨 Testing generateWithTrainedModel...')
    
    const testPrompt = `A portrait of ${testModel.triggerWord}, professional headshot, high quality`
    
    try {
      const result = await replicate.generateWithTrainedModel({
        prompt: testPrompt,
        replicateModelId: testModel.replicateModelId,
        triggerWord: testModel.triggerWord,
        aspectRatio: '1:1',
        steps: 28
      })
      
      console.log('✅ Generation successful!')
      console.log('📊 Result:', {
        id: result.id,
        status: result.status,
        imageUrl: result.imageUrl || 'Processing...',
        provider: result.provider,
        model: result.model
      })
      
    } catch (error) {
      console.log('❌ Generation failed:', error.message)
      
      // If the constructed model ID doesn't work, let's try to find the actual model
      console.log('\n🔍 Checking if the model exists on Replicate...')
      
      try {
        // Try to get the model to see if it exists
        const modelCheck = await replicate.client.models.get(testModel.replicateModelId)
        console.log('✅ Model exists on Replicate:', modelCheck.name)
      } catch (modelError) {
        console.log('❌ Model not found on Replicate:', modelError.message)
        console.log('💡 The constructed model ID might be incorrect')
        
        // Let's try to list models to see what's available
        console.log('\n🔍 Listing your Replicate models...')
        try {
          const models = await replicate.client.models.list()
          const userModels = models.results.filter(m => m.owner === 'micahgp')
          console.log('📋 Your Replicate models:')
          userModels.forEach(model => {
            console.log(`   - ${model.name} (${model.owner}/${model.name})`)
          })
        } catch (listError) {
          console.log('❌ Could not list models:', listError.message)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDirectReplicateGeneration() 