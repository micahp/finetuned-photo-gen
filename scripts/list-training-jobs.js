require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');

async function listTrainingJobs() {
  const prisma = new PrismaClient();
  
  const jobs = await prisma.jobQueue.findMany({
    where: { jobType: 'model_training' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log('📋 Recent Training Jobs:\n');
  jobs.forEach((job, index) => {
    const payload = job.payload;
    console.log(`${index + 1}. Training ID: ${payload.externalTrainingId || job.id}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Error: ${job.errorMessage || 'none'}`);
    console.log(`   Model: ${payload.name || 'Unknown'}`);
    console.log(`   Created: ${job.createdAt.toISOString()}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

listTrainingJobs(); 