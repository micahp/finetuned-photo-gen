import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient, UserModel } from '../src/generated/prisma';
import { ReplicateService } from '../src/lib/replicate-service';

async function populateReplicateModelIds() {
  const prisma = new PrismaClient();
  const replicate = new ReplicateService();
  
  try {
    console.log('🔍 Finding models that need replicateModelId populated...');
    
    const modelsToUpdate = await prisma.userModel.findMany({
      where: {
        externalTrainingId: { not: null },
        externalTrainingService: 'replicate',
        replicateModelId: null,
        status: 'ready',
      },
      include: {
        user: {
          select: { email: true },
        },
      },
    });
    
    if (modelsToUpdate.length === 0) {
      console.log('✅ No models need replicateModelId populated!');
      return;
    }
    
    console.log(`Found ${modelsToUpdate.length} models that need replicateModelId populated:
`);
    
    for (const model of modelsToUpdate) {
      console.log(`📋 Processing model: ${model.name} (ID: ${model.id})`);
      console.log(`   User: ${model.user.email}`);
      
      if (!model.externalTrainingId) {
        console.log(`   ⚠️ Skipping model ${model.name} due to missing externalTrainingId.`);
        console.log();
        continue;
      }
      console.log(`   Training ID: ${model.externalTrainingId}`);
      
      try {
        const trainingStatus = await replicate.getTrainingStatus(model.externalTrainingId);
        
        if (trainingStatus.status === 'succeeded') {
          let destinationModelId: string | null = null;

          // Preferred method: Check output.version (this is usually the full model string)
          if (trainingStatus.output && typeof trainingStatus.output === 'object' && trainingStatus.output.version) {
            destinationModelId = trainingStatus.output.version as string;
            console.log(`   ✅ Found destination model in output.version: ${destinationModelId}`);
          }
          // Fallback: Check input.destination (this might be just the model name, not version)
          else if (trainingStatus.input && typeof trainingStatus.input === 'object' && trainingStatus.input.destination) {
            destinationModelId = trainingStatus.input.destination as string;
            console.log(`   ✅ Found destination model in input.destination: ${destinationModelId}`);
          }
          // Older trainings might have it in a different structure or require construction
          // For now, we'll rely on the above two, as construction is less reliable.
          else {
             console.log(`   🔍 Could not find model ID in output.version or input.destination.`)
             // Replicate often creates models with the pattern: username/model-name-training-id
             // Let's try to construct it based on the training pattern
             const username = 'micahp' // Your Replicate username - TODO: make this dynamic if needed
             const modelNameSlug = model.name.toLowerCase().replace(/\s+/g, '-');
             const trainingIdSuffix = model.externalTrainingId.slice(-8);
             const constructedModelId = `${username}/flux-lora-${modelNameSlug}-${trainingIdSuffix}`;
             
             // We can try to see if this constructed ID exists on Replicate if necessary,
             // but for populating, we prefer what Replicate API explicitly returns.
             console.log(`   🤔 Constructed potential model ID (use with caution): ${constructedModelId}`);
             // To avoid saving potentially incorrect constructed IDs, we'll skip if not found explicitly.
             // destinationModelId = constructedModelId; // Uncomment to use constructed ID
          }
          
          if (destinationModelId) {
            await prisma.userModel.update({
              where: { id: model.id },
              data: {
                replicateModelId: destinationModelId,
              },
            });
            
            console.log(`   💾 Updated database with replicateModelId: ${destinationModelId}`);
          } else {
            console.log(`   ⚠️  Could not determine destination model ID from Replicate API response.`);
            console.log(`   🔍 Training output keys:`, trainingStatus.output ? Object.keys(trainingStatus.output) : 'N/A');
            console.log(`   🔍 Training input keys:`, trainingStatus.input ? Object.keys(trainingStatus.input) : 'N/A');
            // console.log(`   🔍 Full training object:`, JSON.stringify(trainingStatus, null, 2));
          }
        } else {
          console.log(`   ⚠️  Training status: ${trainingStatus.status}`);
          if (trainingStatus.error) {
            console.log(`   ❌ Training error: ${trainingStatus.error}`);
          }
        }
      } catch (error: any) {
        console.log(`   ❌ Error fetching training status: ${error.message}`);
      }
      
      console.log(); // Empty line for readability
    }
    
    console.log('✅ Finished processing all models!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message ? error.message : error);
  } finally {
    await prisma.$disconnect();
  }
}

populateReplicateModelIds(); 