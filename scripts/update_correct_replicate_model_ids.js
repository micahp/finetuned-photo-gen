require('dotenv').config()
const { PrismaClient } = require('../src/generated/prisma')
const { ReplicateService } = require('../src/lib/replicate-service')

async function updateCorrectReplicateModelIds() {
  const prisma = new PrismaClient()
  const replicate = new ReplicateService()
  
  try {
    console.log('🔧 Updating database with correct Replicate model IDs...\n')
    
    // Get models that need correct replicate model IDs
    const modelsToUpdate = await prisma.userModel.findMany({
      where: {
        externalTrainingId: { not: null },
        externalTrainingService: 'replicate',
        status: 'ready'
      },
      include: {
        user: {
          select: { email: true }
        }
      }
    })
    
    if (modelsToUpdate.length === 0) {
      console.log('✅ No models need updating!')
      return
    }
    
    console.log(`Found ${modelsToUpdate.length} models to update:\n`)
    
    for (const model of modelsToUpdate) {
      console.log(`📋 Processing model: ${model.name} (ID: ${model.id})`)
      console.log(`   Training ID: ${model.externalTrainingId}`)
      console.log(`   Current Replicate Model ID: ${model.replicateModelId}`)
      
      try {
        // Get the training status from Replicate
        const trainingStatus = await replicate.getTrainingStatus(model.externalTrainingId)
        
        if (trainingStatus.status === 'succeeded' && trainingStatus.output && trainingStatus.output.version) {
          const correctModelId = trainingStatus.output.version
          
          console.log(`   ✅ Found correct model ID: ${correctModelId}`)
          
          // Update the database
          await prisma.userModel.update({
            where: { id: model.id },
            data: {
              replicateModelId: correctModelId
            }
          })
          
          console.log(`   💾 Updated database with correct replicateModelId`)
          
        } else {
          console.log(`   ⚠️  Training status: ${trainingStatus.status}`)
          console.log(`   ⚠️  No version found in output`)
        }
      } catch (error) {
        console.log(`   ❌ Error fetching training status: ${error.message}`)
      }
      
      console.log() // Empty line for readability
    }
    
    console.log('✅ Finished updating all models!')
    
    // Verify the updates
    console.log('\n🔍 Verifying updates...')
    const updatedModels = await prisma.userModel.findMany({
      where: {
        externalTrainingId: { not: null },
        externalTrainingService: 'replicate',
        status: 'ready'
      }
    })
    
    updatedModels.forEach(model => {
      console.log(`   ${model.name}: ${model.replicateModelId}`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateCorrectReplicateModelIds() 