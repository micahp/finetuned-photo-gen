require('dotenv').config();

async function simulateBrowserRequest() {
  console.log('🌐 Simulating Browser Request to Training Job API\n');
  
  const testTrainingId = 'andamhvr2hrmc0cq0gr841nrrr';
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  try {
    console.log(`📡 Making request to: ${baseUrl}/api/training/jobs/${testTrainingId}`);
    console.log('🔍 Watch the server logs for detailed error information...\n');
    
    const response = await fetch(`${baseUrl}/api/training/jobs/${testTrainingId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add some headers that a browser would typically send
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📊 Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('📊 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    
    if (response.status === 500) {
      console.log('\n🚨 500 ERROR DETECTED!');
      console.log('Check the server logs above for the detailed error message.');
      console.log('The error is likely in the TrainingStatusResolver.resolveStatus() method.');
    } else if (response.status === 401) {
      console.log('\n🔐 Authentication required - this is expected for unauthenticated requests');
    } else if (response.status === 200 && data.success) {
      console.log('\n✅ API working correctly!');
      console.log('The re-upload button should appear based on these conditions:');
      
      const job = data.job;
      const condition1 = job.error?.includes('Model training completed successfully');
      const condition2 = job.debugData?.lastError?.stage === 'huggingface_upload';
      const condition3 = job.status === 'uploading';
      const condition4 = job.status === 'completed' && !job.huggingFaceRepo;
      
      console.log(`- Error includes success: ${condition1}`);
      console.log(`- LastError stage upload: ${condition2}`);
      console.log(`- Status uploading: ${condition3}`);
      console.log(`- Completed no repo: ${condition4}`);
      
      const shouldShow = condition1 || condition2 || condition3 || condition4;
      console.log(`\n🎯 Should show retry button: ${shouldShow ? 'YES' : 'NO'}`);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Server is not running. Start it with: npm run dev');
    }
  }
}

simulateBrowserRequest().catch(console.error); 