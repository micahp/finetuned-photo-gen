import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient, UserModel } from '../src/generated/prisma';
import { ReplicateService } from '../src/lib/replicate-service';

async function updateCorrectReplicateModelIds() {
  const prisma = new PrismaClient();
  const replicate = new ReplicateService();

  try {
    console.log('🔧 Updating database with correct Replicate model IDs (from output.version)...');

    // Get all ready models trained with Replicate
    const modelsToUpdate = await prisma.userModel.findMany({
      where: {
        externalTrainingId: { not: null },
        externalTrainingService: 'replicate',
        status: 'ready',
      },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    if (modelsToUpdate.length === 0) {
      console.log('✅ No models found that were trained on Replicate and are ready.');
      return;
    }

    console.log(`Found ${modelsToUpdate.length} 'ready' Replicate-trained models to check/update:
`);

    let updatedCount = 0;

    for (const model of modelsToUpdate) {
      console.log(`📋 Processing model: ${model.name} (ID: ${model.id})`);
      console.log(`   User: ${model.user.email}`);
      
      if (!model.externalTrainingId) {
        console.log(`   ⚠️ Skipping model ${model.name} due to missing externalTrainingId.`);
        console.log();
        continue;
      }
      console.log(`   Training ID: ${model.externalTrainingId}`);
      console.log(`   Current Replicate Model ID in DB: ${model.replicateModelId || 'Not set'}`);

      try {
        const trainingStatus = await replicate.getTrainingStatus(model.externalTrainingId);

        if (trainingStatus.status === 'succeeded') {
          let correctModelId: string | null = null;

          if (trainingStatus.output && typeof trainingStatus.output === 'object' && trainingStatus.output.version) {
            correctModelId = trainingStatus.output.version as string;
            console.log(`   ✅ Found correct model ID in output.version: ${correctModelId}`);
            
            if (model.replicateModelId !== correctModelId) {
              await prisma.userModel.update({
                where: { id: model.id },
                data: {
                  replicateModelId: correctModelId,
                },
              });
              console.log(`   💾 Updated database with new replicateModelId: ${correctModelId}`);
              updatedCount++;
            } else {
              console.log(`   👍 Current DB replicateModelId is already correct.`);
            }
          } else {
            console.log(`   ⚠️ Could not determine correct model ID from output.version.`);
            console.log(`   🔍 Training output keys:`, trainingStatus.output ? Object.keys(trainingStatus.output) : 'N/A');
          }
        } else {
          console.log(`   ⚠️ Training status: ${trainingStatus.status}. Cannot update model ID.`);
          if (trainingStatus.error) {
            console.log(`   ❌ Training error: ${trainingStatus.error}`);
          }
        }
      } catch (error: any) {
        console.log(`   ❌ Error fetching/processing training status: ${error.message}`);
      }
      console.log(); 
    }

    console.log(`✅ Finished processing all models. ${updatedCount} model(s) were updated.`);

  } catch (error: any) {
    console.error('❌ Top-level error in script:', error.message ? error.message : error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCorrectReplicateModelIds(); 