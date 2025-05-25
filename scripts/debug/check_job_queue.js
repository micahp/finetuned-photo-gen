require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  console.log('🔍 Checking Job Queue for Training ID: r7y4cc09kdrma0cq0hz8jnr50g\n');
  
  // Find the job queue entry for this specific training
  const job = await prisma.jobQueue.findFirst({
    where: {
      jobType: 'model_training',
      payload: {
        path: ['externalTrainingId'],
        equals: 'r7y4cc09kdrma0cq0hz8jnr50g'
      }
    }
  });
  
  if (job) {
    console.log('📋 Job Queue Entry Found:');
    console.log(`  ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Job Type: ${job.jobType}`);
    console.log(`  Error Message: ${job.errorMessage || 'none'}`);
    console.log(`  Created: ${job.createdAt}`);
    console.log(`  Updated: ${job.updatedAt}`);
    console.log('  Payload:');
    console.log(JSON.stringify(job.payload, null, 4));
    
    if (job.status === 'failed' && job.errorMessage?.includes('initializing')) {
      console.log('\n⚠️  FOUND THE ISSUE!');
      console.log('   Job queue shows "failed" with "initializing" error');
      console.log('   But Replicate training actually succeeded');
      console.log('   This is causing the dashboard to show wrong status');
    }
  } else {
    console.log('❌ No job queue entry found for this training ID');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error); 