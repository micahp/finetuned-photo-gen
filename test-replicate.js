import { ReplicateService } from './src/lib/replicate-service.js';

async function testReplicate() {
  try {
    console.log('Testing Replicate API connection...');
    
    // Set the token explicitly for testing
    process.env.REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "your-replicate-token-here";
    
    const replicateService = new ReplicateService();
    
    console.log('Testing with mock training data...');
    
    const mockTrainingParams = {
      modelName: 'test-model',
      triggerWord: 'TESTTOKEN',
      trainingImages: [
        {
          id: '1',
          filename: 'test1.jpg',
          url: 'https://example.com/test1.jpg',
          size: 1024000
        },
        {
          id: '2', 
          filename: 'test2.jpg',
          url: 'https://example.com/test2.jpg',
          size: 1024000
        }
      ],
      zipUrl: 'https://storage.example.com/test-training.zip',
      steps: 1000,
      learningRate: 1e-4,
      loraRank: 16
    };
    
    const result = await replicateService.startTraining(mockTrainingParams);
    
    console.log('Training result:', result);
    
    if (result.status !== 'failed') {
      console.log('✅ SUCCESS: Replicate API connection works!');
    } else {
      console.log('❌ FAILED:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testReplicate(); 