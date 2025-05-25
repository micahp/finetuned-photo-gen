require('dotenv').config();

async function testTrainingAPI() {
  console.log('🧪 Testing Training API Response\n');
  
  const trainingId = 'r7y4cc09kdrma0cq0hz8jnr50g';
  
  try {
    console.log(`Testing individual training job API for: ${trainingId}`);
    const response = await fetch(`http://localhost:3000/api/training/jobs/${trainingId}`, {
      headers: {
        'Cookie': 'authjs.session-token=your-session-token' // This won't work but we can see the structure
      }
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 401) {
      console.log('❌ Unauthorized (expected - no session token)');
      console.log('💡 To test properly, start the Next.js server and access via browser');
      return;
    }
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      console.log('❌ Connection refused - Next.js server not running');
      console.log('💡 Start the server with: npm run dev');
      console.log('💡 Then test the training dashboard at: http://localhost:3000/dashboard/training');
    } else {
      console.error('API test error:', error.message);
    }
  }
}

testTrainingAPI(); 