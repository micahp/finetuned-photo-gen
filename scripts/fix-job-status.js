/**
 * Fix job status discrepancies where jobs are marked as completed but have errors
 */

const { PrismaClient } = require('../src/generated/prisma')

async function fixJobStatus(jobId) {
  const prisma = new PrismaClient()
  
  try {
    console.log(`🔧 Fixing Job ID: ${jobId}`)
    console.log('=' .repeat(60))
    
    // Get the job
    const job = await prisma.jobQueue.findUnique({
      where: { id: jobId }
    })
    
    if (!job) {
      console.log('❌ Job not found')
      return
    }
    
    console.log(`📋 Current Status: ${job.status}`)
    console.log(`📋 Payload Error: ${job.payload?.error || 'None'}`)
    
    // Check if this job needs fixing
    if (job.status === 'completed' && job.payload?.error) {
      console.log('\n🔧 Fixing job status...')
      
      const updatedJob = await prisma.jobQueue.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMessage: job.payload.error
        }
      })
      
      console.log(`✅ Updated job status: ${job.status} → ${updatedJob.status}`)
      console.log(`✅ Set error message: ${updatedJob.errorMessage}`)
      
      // Also check if we need to update the user model
      const userModelId = job.payload?.userModelId
      if (userModelId) {
        const userModel = await prisma.userModel.findUnique({
          where: { id: userModelId }
        })
        
        if (userModel && userModel.status !== 'failed') {
          console.log('\n🔧 Updating user model status...')
          
          const updatedModel = await prisma.userModel.update({
            where: { id: userModelId },
            data: {
              status: 'failed'
            }
          })
          
          console.log(`✅ Updated model status: ${userModel.status} → ${updatedModel.status}`)
        } else if (!userModel) {
          console.log('\n⚠️  User model not found - may have been deleted due to failure')
        }
      }
      
    } else {
      console.log('\n✅ Job status is correct, no fix needed')
    }
    
  } catch (error) {
    console.error('Fix failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function findAndFixAllBuggyJobs() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 Finding all jobs with status discrepancies...')
    
    // Find jobs that are marked as completed but have errors in payload
    const buggyJobs = await prisma.jobQueue.findMany({
      where: {
        status: 'completed',
        payload: {
          path: ['error'],
          not: null
        }
      }
    })
    
    console.log(`Found ${buggyJobs.length} jobs with status discrepancies`)
    
    for (const job of buggyJobs) {
      console.log(`\n🔧 Fixing job ${job.id}...`)
      await fixJobStatus(job.id)
    }
    
    console.log('\n✅ All buggy jobs fixed')
    
  } catch (error) {
    console.error('Bulk fix failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run based on command line arguments
const command = process.argv[2]
const jobId = process.argv[3]

if (command === 'fix-all') {
  findAndFixAllBuggyJobs()
} else if (command === 'fix' && jobId) {
  fixJobStatus(jobId)
} else {
  console.log('Usage:')
  console.log('  node scripts/fix-job-status.js fix <jobId>     - Fix specific job')
  console.log('  node scripts/fix-job-status.js fix-all        - Fix all buggy jobs')
}