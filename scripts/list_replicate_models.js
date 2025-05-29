require('dotenv').config()
const { ReplicateService } = require('../src/lib/replicate-service')

async function listReplicateModels() {
  const replicate = new ReplicateService()
  
  try {
    console.log('🔍 Listing all models on your Replicate account...\n')
    
    const models = await replicate.client.models.list()
    
    console.log(`Found ${models.results.length} total models\n`)
    
    // Filter for your models
    const userModels = models.results.filter(m => m.owner === 'micahgp')
    
    if (userModels.length === 0) {
      console.log('❌ No models found for user "micahgp"')
      console.log('\n📋 All available models:')
      models.results.slice(0, 10).forEach(model => {
        console.log(`   - ${model.owner}/${model.name}`)
      })
      return
    }
    
    console.log(`📋 Your models (${userModels.length} found):`)
    userModels.forEach(model => {
      console.log(`   - ${model.owner}/${model.name}`)
      console.log(`     Description: ${model.description || 'No description'}`)
      console.log(`     Visibility: ${model.visibility}`)
      console.log(`     Created: ${model.created_at}`)
      console.log()
    })
    
    // Also check for any models that might match our training IDs
    console.log('\n🔍 Looking for models that might match our training IDs...')
    const trainingIds = [
      'andamhvr2hrmc0cq0gr841nrrr', // geo2
      'atnpmbmha5rm80cq11mvfnsecc', // geo 3
      '908r039j79rm80cq148tqgnf90', // geo 4
      'r7y4cc09kdrma0cq0hz8jnr50g'  // geo
    ]
    
    const allModels = models.results
    trainingIds.forEach(trainingId => {
      const matchingModels = allModels.filter(model => 
        model.name.includes(trainingId.slice(-8)) || 
        model.name.includes(trainingId)
      )
      
      if (matchingModels.length > 0) {
        console.log(`\n📋 Models matching training ID ${trainingId}:`)
        matchingModels.forEach(model => {
          console.log(`   - ${model.owner}/${model.name}`)
        })
      }
    })
    
  } catch (error) {
    console.error('❌ Error listing models:', error.message)
  }
}

listReplicateModels() 