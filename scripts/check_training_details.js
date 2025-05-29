require('dotenv').config()
const { ReplicateService } = require('../src/lib/replicate-service')

async function checkTrainingDetails() {
  const replicate = new ReplicateService()
  
  const trainingIds = [
    { id: 'andamhvr2hrmc0cq0gr841nrrr', name: 'geo2' },
    { id: 'atnpmbmha5rm80cq11mvfnsecc', name: 'geo 3' },
    { id: '908r039j79rm80cq148tqgnf90', name: 'geo 4' },
    { id: 'r7y4cc09kdrma0cq0hz8jnr50g', name: 'geo' }
  ]
  
  try {
    console.log('🔍 Checking training details for all models...\n')
    
    for (const training of trainingIds) {
      console.log(`📋 Training: ${training.name} (${training.id})`)
      
      try {
        const trainingStatus = await replicate.getTrainingStatus(training.id)
        
        console.log(`   Status: ${trainingStatus.status}`)
        console.log(`   Model: ${trainingStatus.model || 'None'}`)
        console.log(`   Version: ${trainingStatus.version || 'None'}`)
        
        if (trainingStatus.input) {
          console.log(`   Input keys: ${Object.keys(trainingStatus.input).join(', ')}`)
          if (trainingStatus.input.destination) {
            console.log(`   Destination: ${trainingStatus.input.destination}`)
          }
        }
        
        if (trainingStatus.output) {
          console.log(`   Output type: ${typeof trainingStatus.output}`)
          if (Array.isArray(trainingStatus.output)) {
            console.log(`   Output files: ${trainingStatus.output.length} files`)
            trainingStatus.output.forEach((file, index) => {
              console.log(`     ${index + 1}. ${file}`)
            })
          } else {
            console.log(`   Output: ${JSON.stringify(trainingStatus.output)}`)
          }
        }
        
        // Check if there's a way to use the training directly
        console.log(`   URLs: ${trainingStatus.urls ? Object.keys(trainingStatus.urls).join(', ') : 'None'}`)
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`)
      }
      
      console.log()
    }
    
    console.log('💡 Key insights:')
    console.log('   - If no destination models exist, we might need to use the LoRA files directly')
    console.log('   - The output URLs point to the trained LoRA weights (.safetensors files)')
    console.log('   - We can use these with the base FLUX model for inference')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkTrainingDetails() 