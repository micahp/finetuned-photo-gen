/**
 * Investigate specific job ID to understand status discrepancy
 */

const { PrismaClient } = require('@prisma/client')
const { ReplicateService } = require('../src/lib/replicate-service')
const { HuggingFaceService } = require('../src/lib/huggingface-service')
const { TrainingStatusResolver } = require('../src/lib/training-status-resolver')

async function investigateJob(jobId) {
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
    if (!externalTrainingId) {
      console.log('❌ No external training ID found in payload')
      return
    }
    
    console.log(`\n🔗 External Training ID: ${externalTrainingId}`)
    
    // 2. Get user model record
    const userModel = await prisma.userModel.findFirst({
      where: { externalTrainingId: externalTrainingId }
    })
    
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
    
    // 3. Check Replicate status
    console.log('\n🤖 Replicate Status:')
    try {
      const replicateService = new ReplicateService()
      const replicateStatus = await replicateService.getTrainingStatus(externalTrainingId)
      
      console.log(`   Status: ${replicateStatus.status}`)
      console.log(`   Error: ${replicateStatus.error || 'None'}`)
      console.log(`   Output: ${replicateStatus.output ? JSON.stringify(replicateStatus.output) : 'None'}`)
      console.log(`   Logs (last 200 chars): ${replicateStatus.logs ? replicateStatus.logs.slice(-200) : 'None'}`)
      
      // 4. Check HuggingFace status if repo exists
      if (userModel?.huggingfaceRepo) {
        console.log('\n🤗 HuggingFace Status:')
        try {
          const hfService = new HuggingFaceService()
          const repoStatus = await hfService.getRepoStatus(userModel.huggingfaceRepo)
          
          console.log(`   Repo ID: ${repoStatus.id}`)
          console.log(`   Model Ready: ${repoStatus.modelReady}`)
          console.log(`   Downloads: ${repoStatus.downloads}`)
          console.log(`   Created: ${repoStatus.createdAt}`)
          console.log(`   Updated: ${repoStatus.updatedAt}`)
          
        } catch (hfError) {
          console.log(`   ❌ HuggingFace Error: ${hfError.message}`)
        }
      }
      
      // 5. Run status resolution logic
      console.log('\n🧠 Status Resolution Analysis:')
      
      const sources = {
        jobQueue: {
          status: job.status,
          errorMessage: job.errorMessage,
          completedAt: job.completedAt
        },
        replicate: {
          status: replicateStatus.status,
          error: replicateStatus.error,
          logs: replicateStatus.logs
        },
        userModel: {
          status: userModel?.status || 'unknown',
          huggingfaceRepo: userModel?.huggingfaceRepo,
          loraReadyForInference: userModel?.loraReadyForInference || false,
          trainingCompletedAt: userModel?.trainingCompletedAt
        }
      }
      
      console.log('   Input Sources:')
      console.log(`     Job Queue: ${sources.jobQueue.status}`)
      console.log(`     Replicate: ${sources.replicate.status}`)
      console.log(`     User Model: ${sources.userModel.status}`)
      console.log(`     HF Repo: ${sources.userModel.huggingfaceRepo ? 'Yes' : 'No'}`)
      console.log(`     LoRA Ready: ${sources.userModel.loraReadyForInference}`)
      
      const resolvedStatus = TrainingStatusResolver.resolveStatus(
        externalTrainingId,
        userModel?.name || 'Unknown Model',
        sources
      )
      
      console.log('\n   Resolved Status:')
      console.log(`     Status: ${resolvedStatus.status}`)
      console.log(`     Progress: ${resolvedStatus.progress}%`)
      console.log(`     Stage: ${resolvedStatus.stage}`)
      console.log(`     Needs Upload: ${resolvedStatus.needsUpload}`)
      console.log(`     Can Retry Upload: ${resolvedStatus.canRetryUpload}`)
      console.log(`     Error: ${resolvedStatus.error || 'None'}`)
      
      // 6. Identify discrepancies
      console.log('\n🚨 Discrepancy Analysis:')
      
      const hasHuggingFaceRepo = !!userModel?.huggingfaceRepo
      const isModelReady = userModel?.status === 'ready' && userModel?.loraReadyForInference
      
      if (resolvedStatus.status === 'completed' && !hasHuggingFaceRepo) {
        console.log('   ⚠️  ISSUE: Status shows completed but no HuggingFace repo exists')
      }
      
      if (resolvedStatus.status === 'completed' && !isModelReady) {
        console.log('   ⚠️  ISSUE: Status shows completed but model is not ready for inference')
      }
      
      if (replicateStatus.status === 'failed' && resolvedStatus.status !== 'failed') {
        console.log('   ⚠️  ISSUE: Replicate failed but resolved status is not failed')
      }
      
      if (replicateStatus.status === 'canceled' && resolvedStatus.status !== 'failed') {
        console.log('   ⚠️  ISSUE: Replicate canceled but resolved status is not failed')
      }
      
      if (job.status === 'failed' && resolvedStatus.status === 'completed') {
        console.log('   ⚠️  ISSUE: Job queue shows failed but resolved status is completed')
        console.log('   💡 This might be due to the fallback logic overriding job queue status')
      }
      
      console.log('\n✅ Investigation complete')
      
    } catch (replicateError) {
      console.log(`   ❌ Replicate Error: ${replicateError.message}`)
    }
    
  } catch (error) {
    console.error('Investigation failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run investigation
const jobId = process.argv[2] || 'cmb1xxeo6000pshwc5ewpliof'
investigateJob(jobId) 