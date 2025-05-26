require('dotenv').config();

async function testAPIResponse() {
  console.log('🧪 Testing API Response for Training Job\n');
  
  const testTrainingId = 'andamhvr2hrmc0cq0gr841nrrr';
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  try {
    console.log(`🌐 Using base URL from .env: ${baseUrl}`);
    console.log('⚠️  Note: This will fail without authentication, but we can see if the server is running');
    
    const response = await fetch(`${baseUrl}/api/training/jobs/${testTrainingId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const data = await response.json();
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log('📊 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.job) {
      const job = data.job;
      console.log('\n🎯 KEY FIELDS FOR RETRY UPLOAD:');
      console.log('==============================');
      console.log(`Status: ${job.status}`);
      console.log(`HuggingFace Repo: ${job.huggingFaceRepo || 'none'}`);
      console.log(`Debug Data - needsUpload: ${job.debugData?.needsUpload || 'not set'}`);
      console.log(`Debug Data - canRetryUpload: ${job.debugData?.canRetryUpload || 'not set'}`);
      
      console.log('\n🔍 RETRY BUTTON CONDITIONS:');
      console.log('===========================');
      
      // Check the conditions from the frontend
      const condition1 = job.error?.includes('Model training completed successfully');
      const condition2 = job.debugData?.lastError?.stage === 'huggingface_upload';
      const condition3 = job.status === 'uploading';
      const condition4 = job.status === 'completed' && !job.huggingFaceRepo;
      
      console.log(`Condition 1 (error includes success): ${condition1}`);
      console.log(`Condition 2 (lastError stage upload): ${condition2}`);
      console.log(`Condition 3 (status uploading): ${condition3}`);
      console.log(`Condition 4 (completed no repo): ${condition4}`);
      
      const shouldShowRetryButton = condition1 || condition2 || condition3 || condition4;
      console.log(`\n🎯 Should show retry button: ${shouldShowRetryButton ? 'YES' : 'NO'}`);
      
      // Check upload section conditions
      const uploadCondition1 = job.debugData?.canRetryUpload;
      const uploadCondition2 = job.status === 'completed' && !job.huggingFaceRepo && !job.error;
      const uploadCondition3 = job.status === 'uploading' && job.debugData?.needsUpload;
      
      console.log(`\nUpload Section Condition 1 (canRetryUpload): ${uploadCondition1}`);
      console.log(`Upload Section Condition 2 (completed no repo no error): ${uploadCondition2}`);
      console.log(`Upload Section Condition 3 (uploading needsUpload): ${uploadCondition3}`);
      
      const shouldShowUploadSection = uploadCondition1 || uploadCondition2 || uploadCondition3;
      console.log(`\n🎯 Should show upload section: ${shouldShowUploadSection ? 'YES' : 'NO'}`);
      
    } else if (data.error?.includes('Unauthorized')) {
      console.log('\n💡 This is expected - the API requires authentication');
      console.log('   To test properly, you need to:');
      console.log('   1. Go to the dashboard in your browser');
      console.log(`   2. Navigate to ${baseUrl}/dashboard/training/${testTrainingId}`);
      console.log('   3. Check if the retry upload button appears');
    }
    
  } catch (fetchError) {
    console.log(`❌ API call failed: ${fetchError.message}`);
    
    if (fetchError.message.includes('ECONNREFUSED')) {
      console.log('\n💡 The Next.js server is not running.');
      console.log('   To test this properly:');
      console.log('   1. Run: npm run dev');
      console.log('   2. Then run this script again');
    }
  }
}

testAPIResponse().catch(console.error); 