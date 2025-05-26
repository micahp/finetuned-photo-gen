require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');

async function testRetryUploadSimple() {
  const prisma = new PrismaClient();
  
  console.log('🧪 Testing Retry Upload API for geo2 model...\n');
  
  try {
    // Get the model we created
    const model = await prisma.userModel.findFirst({
      where: { 
        name: 'geo2',
        externalTrainingId: 'andamhvr2hrmc0cq0gr841nrrr'
      }
    });
    
    if (!model) {
      console.log('❌ Model not found');
      return;
    }
    
    console.log(`📋 Model found: ${model.name} (${model.id})`);
    console.log(`   Status: ${model.status}`);
    console.log(`   External Training ID: ${model.externalTrainingId}`);
    console.log(`   HuggingFace Repo: ${model.huggingfaceRepo || 'none'}`);
    console.log(`   Ready for retry: ${['failed', 'training', 'uploading'].includes(model.status) ? 'Yes' : 'No'}`);
    
    console.log('\n🔄 Testing retry upload API call...');
    console.log('⚠️  Note: This will fail without authentication, but we can see the error response');
    
    try {
      const response = await fetch('http://localhost:3000/api/models/retry-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: model.id
        })
      });
      
      const data = await response.json();
      
      console.log(`\n📊 Response Status: ${response.status}`);
      console.log('📊 Response Data:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.success) {
        console.log('\n✅ Retry upload succeeded!');
        console.log(`   New HuggingFace Repo: ${data.model?.huggingfaceRepo || 'not specified'}`);
      } else {
        console.log('\n❌ Retry upload failed');
        console.log(`   Error: ${data.error}`);
        console.log(`   Details: ${data.details || 'none'}`);
        
        // Check for common error patterns
        if (data.error?.includes('Unauthorized')) {
          console.log('\n💡 This is expected - the API requires authentication');
          console.log('   The model setup is correct, but you need to test through the UI');
        } else if (data.error?.includes('not eligible')) {
          console.log('\n💡 Model status issue - check eligibility criteria');
        } else if (data.error?.includes('Replicate training status')) {
          console.log('\n💡 Replicate training status issue');
        } else {
          console.log('\n💡 Unexpected error - investigate further');
        }
      }
      
    } catch (fetchError) {
      console.log(`❌ API call failed: ${fetchError.message}`);
      
      if (fetchError.message.includes('ECONNREFUSED')) {
        console.log('\n💡 The Next.js server is not running.');
        console.log('   To test this properly:');
        console.log('   1. Run: npm run dev');
        console.log('   2. Go to the dashboard in your browser');
        console.log('   3. Find the "geo2" model');
        console.log('   4. Click the retry upload button');
      }
    }
    
    // Check if model status changed
    const updatedModel = await prisma.userModel.findUnique({
      where: { id: model.id }
    });
    
    if (updatedModel && updatedModel.status !== model.status) {
      console.log('\n📊 Model status changed:');
      console.log(`   Before: ${model.status}`);
      console.log(`   After: ${updatedModel.status}`);
      console.log(`   HF Repo: ${updatedModel.huggingfaceRepo || 'none'}`);
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRetryUploadSimple().catch(console.error); 