import { NextRequest, NextResponse } from 'next/server'
import { ReplicateService } from '@/lib/replicate-service'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Replicate API connection...')
    
    // Test environment variable loading
    console.log('Environment variables check:')
    console.log('REPLICATE_API_TOKEN exists:', !!process.env.REPLICATE_API_TOKEN)
    console.log('Token prefix:', process.env.REPLICATE_API_TOKEN?.substring(0, 8))
    
    // Initialize Replicate service
    const replicateService = new ReplicateService()
    
    // Get available trainers (this doesn't require authentication)
    const trainers = replicateService.getAvailableTrainers()
    
    console.log('✅ ReplicateService initialized successfully!')
    console.log('Available trainers:', trainers)
    
    return NextResponse.json({
      success: true,
      message: 'Replicate API connection successful',
      environmentCheck: {
        hasToken: !!process.env.REPLICATE_API_TOKEN,
        tokenPrefix: process.env.REPLICATE_API_TOKEN?.substring(0, 8)
      },
      availableTrainers: trainers
    })
    
  } catch (error) {
    console.error('❌ Replicate test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environmentCheck: {
        hasToken: !!process.env.REPLICATE_API_TOKEN,
        allEnvKeys: Object.keys(process.env).filter(key => key.includes('REPLICATE'))
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Testing Replicate training with correct version...')
    
    const replicateService = new ReplicateService()
    
    // Test with minimal training parameters
    const testParams = {
      modelName: 'test-model',
      triggerWord: 'TESTTOKEN',
      trainingImages: [
        {
          id: '1',
          filename: 'test1.jpg',
          url: 'https://example.com/test1.jpg',
          size: 1024000
        }
      ],
      zipUrl: 'https://example.com/test-training.zip',
      steps: 1000,
      learningRate: 1e-4,
      loraRank: 16
    }
    
    console.log('Starting test training with corrected version...')
    const result = await replicateService.startTraining(testParams)
    
    return NextResponse.json({
      success: true,
      message: 'Training test completed',
      result: result
    })
    
  } catch (error) {
    console.error('❌ Training test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 