require('dotenv').config()
const { ReplicateService } = require('../src/lib/replicate-service')

async function checkTrainingOutput() {
  const replicate = new ReplicateService()
  
  // Check one of the training IDs to see what the output contains
  const trainingId = 'andamhvr2hrmc0cq0gr841nrrr' // geo2 model
  
  try {
    console.log(`🔍 Checking training output for: ${trainingId}\n`)
    
    const trainingStatus = await replicate.getTrainingStatus(trainingId)
    
    console.log('📊 Training Status:', trainingStatus.status)
    console.log('📊 Training Keys:', Object.keys(trainingStatus))
    
    if (trainingStatus.output) {
      console.log('\n📦 Training Output:')
      console.log(JSON.stringify(trainingStatus.output, null, 2))
    }
    
    if (trainingStatus.urls) {
      console.log('\n🔗 Training URLs:')
      console.log(JSON.stringify(trainingStatus.urls, null, 2))
    }
    
    // Check if there's a model field or version field
    if (trainingStatus.model) {
      console.log('\n🏷️  Training Model:', trainingStatus.model)
    }
    
    if (trainingStatus.version) {
      console.log('\n📦 Training Version:', trainingStatus.version)
    }
    
    console.log('\n📋 Full Training Object:')
    console.log(JSON.stringify(trainingStatus, null, 2))
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkTrainingOutput() 