/**
 * Test script to verify upload deduplication fix
 * This simulates the scenario that was causing repeated HuggingFace uploads
 */

const { TrainingService } = require('../src/lib/training-service.ts')

async function testUploadDeduplication() {
  console.log('🧪 Testing upload deduplication fix...')
  
  const trainingService = new TrainingService()
  const testTrainingId = 'test-upload-fix-' + Date.now()
  const testModelName = 'Test Model'
  
  // Mock the replicate service to simulate a completed training
  const originalReplicateGetStatus = trainingService.replicate.getTrainingStatus
  trainingService.replicate.getTrainingStatus = async (id) => ({
    id: id,
    status: 'succeeded',
    output: {
      weights: 'https://replicate.delivery/test/weights.tar'
    },
    logs: 'Training completed successfully'
  })
  
  // Mock the HuggingFace service to track upload calls
  let uploadCallCount = 0
  const originalUploadModel = trainingService.huggingface.uploadModel
  trainingService.huggingface.uploadModel = async (params) => {
    uploadCallCount++
    console.log(`📤 HuggingFace upload called (call #${uploadCallCount}) for: ${params.modelName}`)
    
    return {
      repoId: `test-user/${params.modelName}`,
      repoUrl: `https://huggingface.co/test-user/${params.modelName}`,
      status: 'completed'
    }
  }
  
  try {
    console.log('\n1️⃣ First status check (allowUpload=false) - should NOT trigger upload')
    const status1 = await trainingService.getTrainingStatus(testTrainingId, testModelName, false)
    console.log(`   Status: ${status1.status}, Progress: ${status1.progress}%`)
    console.log(`   Upload calls so far: ${uploadCallCount}`)
    
    console.log('\n2️⃣ Second status check (allowUpload=false) - should NOT trigger upload')
    const status2 = await trainingService.getTrainingStatus(testTrainingId, testModelName, false)
    console.log(`   Status: ${status2.status}, Progress: ${status2.progress}%`)
    console.log(`   Upload calls so far: ${uploadCallCount}`)
    
    console.log('\n3️⃣ Manual upload trigger (allowUpload=true) - should trigger upload ONCE')
    const status3 = await trainingService.getTrainingStatus(testTrainingId, testModelName, true)
    console.log(`   Status: ${status3.status}, Progress: ${status3.progress}%`)
    console.log(`   Upload calls so far: ${uploadCallCount}`)
    
    console.log('\n4️⃣ Another manual trigger (allowUpload=true) - should NOT trigger upload again')
    const status4 = await trainingService.getTrainingStatus(testTrainingId, testModelName, true)
    console.log(`   Status: ${status4.status}, Progress: ${status4.progress}%`)
    console.log(`   Upload calls so far: ${uploadCallCount}`)
    
    console.log('\n5️⃣ Multiple rapid status checks - should NOT trigger any uploads')
    for (let i = 0; i < 5; i++) {
      await trainingService.getTrainingStatus(testTrainingId, testModelName, false)
    }
    console.log(`   Upload calls after 5 rapid checks: ${uploadCallCount}`)
    
    // Test results
    console.log('\n📊 TEST RESULTS:')
    if (uploadCallCount === 1) {
      console.log('✅ SUCCESS: Upload was called exactly once, as expected')
      console.log('✅ Multiple status checks did not trigger duplicate uploads')
      console.log('✅ Upload deduplication is working correctly')
    } else {
      console.log(`❌ FAILURE: Upload was called ${uploadCallCount} times (expected: 1)`)
      console.log('❌ Upload deduplication is NOT working correctly')
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
  } finally {
    // Restore original methods
    trainingService.replicate.getTrainingStatus = originalReplicateGetStatus
    trainingService.huggingface.uploadModel = originalUploadModel
  }
}

// Run the test
testUploadDeduplication().then(() => {
  console.log('\n🏁 Test completed')
  process.exit(0)
}).catch(error => {
  console.error('💥 Test crashed:', error)
  process.exit(1)
}) 