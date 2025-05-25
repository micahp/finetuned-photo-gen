/**
 * Simple investigation of job status using direct database queries
 */

const { PrismaClient } = require('../src/generated/prisma')

async function investigateJobSimple(jobId) {
  const prisma = new PrismaClient()
  
  try {
    console.log(`🔍 Investigating Job ID: ${jobId}`)
    console.log('=' .repeat(60))
    
    // 1. Get job queue record
    const job = await prisma.jobQueue.findUnique({
      where: { id: jobId }
    })
    
    if (!job) {
      console.log('❌ Job not found in database')
      return
    }
    
    console.log('📋 Job Queue Record:')
    console.log(`   Status: ${job.status}`)
    console.log(`   Created: ${job.createdAt}`)
    console.log(`   Updated: ${job.updatedAt}`)
    console.log(`   Completed: ${job.completedAt}`)
    console.log(`   Error: ${job.errorMessage || 'None'}`)
    console.log(`   Payload:`, JSON.stringify(job.payload, null, 2))
    
    // Extract external training ID
    const externalTrainingId = job.payload?.externalTrainingId
    const userModelId = job.payload?.userModelId
    
    if (!externalTrainingId && !userModelId) {
      console.log('❌ No external training ID or user model ID found in payload')
      return
    }
    
    if (externalTrainingId) {
      console.log(`\n🔗 External Training ID: ${externalTrainingId}`)
    }
    
    if (userModelId) {
      console.log(`\n👤 User Model ID: ${userModelId}`)
    }
    
    // 2. Get user model record
    let userModel = null
    
    if (userModelId) {
      // Try to find by user model ID first
      userModel = await prisma.userModel.findUnique({
        where: { id: userModelId }
      })
    } else if (externalTrainingId) {
      // Fallback to external training ID
      userModel = await prisma.userModel.findFirst({
        where: { externalTrainingId: externalTrainingId }
      })
    }
    
    console.log('\n👤 User Model Record:')
    if (userModel) {
      console.log(`   ID: ${userModel.id}`)
      console.log(`   Name: ${userModel.name}`)
      console.log(`   Status: ${userModel.status}`)
      console.log(`   HuggingFace Repo: ${userModel.huggingfaceRepo || 'None'}`)
      console.log(`   HuggingFace Status: ${userModel.huggingfaceStatus || 'None'}`)
      console.log(`   LoRA Ready: ${userModel.loraReadyForInference}`)
      console.log(`   Training Completed: ${userModel.trainingCompletedAt || 'None'}`)
      console.log(`   Created: ${userModel.createdAt}`)
      console.log(`   Updated: ${userModel.updatedAt}`)
    } else {
      console.log('   ❌ No user model found')
    }
    
    // 3. Analyze the discrepancy
    console.log('\n🚨 Status Analysis:')
    
    const hasHuggingFaceRepo = !!userModel?.huggingfaceRepo
    const isModelReady = userModel?.status === 'ready' && userModel?.loraReadyForInference
    
    console.log(`   Job Queue Status: ${job.status}`)
    console.log(`   User Model Status: ${userModel?.status || 'None'}`)
    console.log(`   Has HuggingFace Repo: ${hasHuggingFaceRepo}`)
    console.log(`   Model Ready for Inference: ${isModelReady}`)
    
    // 4. Identify potential issues
    console.log('\n🔍 Potential Issues:')
    
    // Check for error in payload
    if (job.payload?.error) {
      console.log('   🔴 CRITICAL: Job payload contains error message')
      console.log(`   Error: ${job.payload.error}`)
      console.log('   💡 This indicates the job failed but was marked as completed')
    }
    
    if (job.status === 'completed' && job.payload?.error) {
      console.log('   🔴 CRITICAL: Job marked completed despite having error in payload')
      console.log('   💡 This is a bug in the job processing logic')
    }
    
    if (job.status === 'succeeded' && !hasHuggingFaceRepo) {
      console.log('   ⚠️  Job shows succeeded but no HuggingFace repo exists')
      console.log('   💡 This suggests the training completed but upload failed or was never attempted')
    }
    
    if (job.status === 'succeeded' && !isModelReady) {
      console.log('   ⚠️  Job shows succeeded but model is not ready for inference')
      console.log('   💡 This suggests incomplete upload or model processing')
    }
    
    if (job.status === 'failed' && userModel?.status === 'ready') {
      console.log('   ⚠️  Job shows failed but user model shows ready')
      console.log('   💡 This suggests a status synchronization issue')
    }
    
    if (job.errorMessage && job.status !== 'failed') {
      console.log('   ⚠️  Job has error message but status is not failed')
      console.log(`   Error: ${job.errorMessage}`)
    }
    
    if (!userModel && userModelId) {
      console.log('   🔴 CRITICAL: User model was deleted or never created')
      console.log('   💡 The model may have been deleted due to the training failure')
    }
    
    // 5. Check for common patterns
    console.log('\n📊 Common Issue Patterns:')
    
    if (job.status === 'succeeded' && !userModel) {
      console.log('   🔴 PATTERN: Job succeeded but no user model created')
      console.log('   💡 This suggests the job completed but model creation failed')
    }
    
    if (job.status === 'succeeded' && userModel?.status === 'training') {
      console.log('   🔴 PATTERN: Job succeeded but model still shows training')
      console.log('   💡 This suggests status update failure after job completion')
    }
    
    if (job.completedAt && !userModel?.trainingCompletedAt) {
      console.log('   🔴 PATTERN: Job completed but model has no completion timestamp')
      console.log('   💡 This suggests incomplete status synchronization')
    }
    
    // 6. Recommendations
    console.log('\n💡 Recommendations:')
    
    if (job.status === 'completed' && job.payload?.error) {
      console.log('   🔧 URGENT: Fix job processing logic to mark jobs as failed when errors occur')
      console.log('   📝 This job should have status "failed", not "completed"')
      console.log('   🔧 Update job status to "failed" and set errorMessage from payload')
    }
    
    if (job.payload?.error?.includes('404')) {
      console.log('   🔧 404 error suggests API endpoint issue or invalid training ID')
      console.log('   📝 Check if Replicate API endpoints have changed')
      console.log('   📝 Verify training ID format and API authentication')
    }
    
    if (!userModel && userModelId) {
      console.log('   🔧 Consider recreating user model record if training should be retried')
      console.log('   📝 Or mark this training as permanently failed')
    }
    
    if (job.status === 'succeeded' && !hasHuggingFaceRepo && userModel) {
      console.log('   🔧 Consider triggering manual HuggingFace upload')
      console.log('   📝 Check if Replicate training actually succeeded')
    }
    
    if (job.status === 'failed' && job.errorMessage) {
      console.log('   🔧 Review error message for root cause')
      console.log('   📝 Consider if this is a transient error that could be retried')
    }
    
    if (!userModel && job.payload?.externalTrainingId) {
      console.log('   🔧 User model may need to be created manually')
      console.log('   📝 Check if the training workflow was interrupted')
    }
    
    console.log('\n✅ Investigation complete')
    
  } catch (error) {
    console.error('Investigation failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run investigation
const jobId = process.argv[2] || 'cmb1xxeo6000pshwc5ewpliof'
investigateJobSimple(jobId) 