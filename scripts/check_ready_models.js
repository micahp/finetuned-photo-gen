const { PrismaClient } = require('../src/generated/prisma')

async function checkReadyModels() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Checking ready models...\n')
    
    // Get all models that are marked as ready for inference
    const readyModels = await prisma.userModel.findMany({
      where: {
        loraReadyForInference: true,
        status: 'ready'
      },
      include: {
        user: {
          select: { email: true }
        }
      }
    })
    
    console.log(`Found ${readyModels.length} models ready for inference:\n`)
    
    for (const model of readyModels) {
      console.log(`📋 Model: ${model.name} (ID: ${model.id})`)
      console.log(`   User: ${model.user.email}`)
      console.log(`   Status: ${model.status}`)
      console.log(`   LoRA Ready: ${model.loraReadyForInference}`)
      console.log(`   External Training ID: ${model.externalTrainingId || 'None'}`)
      console.log(`   External Training Service: ${model.externalTrainingService || 'None'}`)
      console.log(`   Replicate Model ID: ${model.replicateModelId || 'None'}`)
      console.log(`   HuggingFace Repo: ${model.huggingfaceRepo || 'None'}`)
      console.log(`   HuggingFace Status: ${model.huggingfaceStatus || 'None'}`)
      console.log(`   Training Completed: ${model.trainingCompletedAt || 'None'}`)
      console.log(`   Trigger Word: ${model.triggerWord || 'None'}`)
      
      // Check what needs to be updated for Replicate-direct flow
      const needsUpdate = []
      
      if (!model.replicateModelId && model.externalTrainingId) {
        needsUpdate.push('Missing replicateModelId - needs to be populated from training')
      }
      
      if (!model.externalTrainingService) {
        needsUpdate.push('Missing externalTrainingService - should be "replicate"')
      }
      
      if (needsUpdate.length > 0) {
        console.log(`   ⚠️  NEEDS UPDATE:`)
        needsUpdate.forEach(issue => console.log(`      - ${issue}`))
      } else {
        console.log(`   ✅ Ready for Replicate-direct generation`)
      }
      
      console.log('')
    }
    
    // Summary
    const modelsNeedingUpdate = readyModels.filter(model => 
      !model.replicateModelId || !model.externalTrainingService
    )
    
    console.log(`\n📊 SUMMARY:`)
    console.log(`   Total ready models: ${readyModels.length}`)
    console.log(`   Models needing update: ${modelsNeedingUpdate.length}`)
    console.log(`   Models ready for Replicate-direct: ${readyModels.length - modelsNeedingUpdate.length}`)
    
    if (modelsNeedingUpdate.length > 0) {
      console.log(`\n🔧 Models that need data updates:`)
      modelsNeedingUpdate.forEach(model => {
        console.log(`   - ${model.name} (${model.id})`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error checking models:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkReadyModels() 