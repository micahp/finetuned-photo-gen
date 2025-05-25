require('dotenv').config();
const { PrismaClient } = require('./src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  console.log('🧪 Testing Retry Upload Functionality...\n');
  
  // Get the model that needs re-upload
  const model = await prisma.userModel.findFirst({
    where: { 
      name: 'geo',
      externalTrainingId: 'r7y4cc09kdrma0cq0hz8jnr50g'
    }
  });
  
  if (!model) {
    console.log('❌ Model not found');
    return;
  }
  
  console.log(`📋 Model to test: ${model.name} (${model.id})`);
  console.log(`   Status: ${model.status}`);
  console.log(`   External Training ID: ${model.externalTrainingId}`);
  console.log(`   Ready for retry: ${model.status === 'training' && model.externalTrainingId ? 'Yes' : 'No'}`);
  
  if (model.status !== 'training') {
    console.log('⚠️  Model status is not "training" - may not be eligible for retry');
  }
  
  console.log('\n🔄 Calling retry upload API...');
  
  try {
    const response = await fetch('http://localhost:3000/api/models/retry-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This won't work without authentication, but we can see the error response
      },
      body: JSON.stringify({
        modelId: model.id
      })
    });
    
    const data = await response.json();
    
    console.log(`Response Status: ${response.status}`);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Retry upload succeeded!');
      console.log(`   New HuggingFace Repo: ${data.model?.huggingfaceRepo || 'not specified'}`);
      
      // Check updated model status
      const updatedModel = await prisma.userModel.findUnique({
        where: { id: model.id }
      });
      
      if (updatedModel) {
        console.log('\n📊 Updated Model Status:');
        console.log(`   Status: ${updatedModel.status}`);
        console.log(`   HF Repo: ${updatedModel.huggingfaceRepo || 'none'}`);
        console.log(`   LoRA Ready: ${updatedModel.loraReadyForInference}`);
      }
    } else {
      console.log('\n❌ Retry upload failed');
      console.log(`   Error: ${data.error}`);
      console.log(`   Details: ${data.details || 'none'}`);
    }
    
  } catch (error) {
    console.log('❌ API call failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 The API call failed because the Next.js server is not running.');
      console.log('   To test this properly, run: npm run dev');
      console.log('   Then test the retry upload through the dashboard UI.');
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error); 