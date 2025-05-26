require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');

async function checkModelDetails() {
  const prisma = new PrismaClient();

  const modelIdToCheck = 'cmb2qmsdf0001shg1x7cire31';
  const externalTrainingIdToCheck = 'andamhvr2hrmc0cq0gr841nrrr';

  console.log(`🔍 Checking details for modelId: ${modelIdToCheck}\n`);
  try {
    const modelById = await prisma.userModel.findUnique({
      where: { id: modelIdToCheck },
      select: {
        id: true,
        userId: true,
        name: true,
        externalTrainingId: true,
        status: true,
      },
    });

    if (modelById) {
      console.log('✅ Model found by ID:');
      console.log(`  DB ID: ${modelById.id}`);
      console.log(`  User ID: ${modelById.userId}`);
      console.log(`  Name: ${modelById.name}`);
      console.log(`  External Training ID: ${modelById.externalTrainingId}`);
      console.log(`  Status: ${modelById.status}`);
    } else {
      console.log(`❌ Model with ID '${modelIdToCheck}' NOT FOUND.`);
    }
  } catch (error) {
    console.error(`Error querying model by ID '${modelIdToCheck}':`, error);
  }

  console.log(`\n🔍 Checking details for externalTrainingId: ${externalTrainingIdToCheck}\n`);
  try {
    const modelByExternalId = await prisma.userModel.findFirst({
      where: { externalTrainingId: externalTrainingIdToCheck },
      select: {
        id: true,
        userId: true,
        name: true,
        externalTrainingId: true,
        status: true,
      },
    });

    if (modelByExternalId) {
      console.log('✅ Model found by External Training ID:');
      console.log(`  DB ID: ${modelByExternalId.id}`);
      console.log(`  User ID: ${modelByExternalId.userId}`);
      console.log(`  Name: ${modelByExternalId.name}`);
      console.log(`  External Training ID: ${modelByExternalId.externalTrainingId}`);
      console.log(`  Status: ${modelByExternalId.status}`);
    } else {
      console.log(`❌ Model with External Training ID '${externalTrainingIdToCheck}' NOT FOUND.`);
    }
  } catch (error) {
    console.error(`Error querying model by External Training ID '${externalTrainingIdToCheck}':`, error);
  }

  await prisma.$disconnect();
}

checkModelDetails(); 