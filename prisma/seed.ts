import { PrismaClient } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
      credits: 50,
      subscriptionStatus: 'pro',
      subscriptionPlan: 'pro_monthly'
    }
  })

  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      password: hashedPassword,
      credits: 10,
      subscriptionStatus: 'free'
    }
  })

  console.log('✅ Created users:', { demoUser: demoUser.id, testUser: testUser.id })

  // Create sample user models
  const portraitModel = await prisma.userModel.upsert({
    where: { id: 'demo-portrait-model' },
    update: {},
    create: {
      id: 'demo-portrait-model',
      userId: demoUser.id,
      name: 'Portrait Model',
      status: 'ready',
      triggerWord: 'PORTRAIT_PERSON',
      trainingImagesCount: 15,
      trainingStartedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      trainingCompletedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      externalTrainingId: 'replicate_training_123',
      externalTrainingService: 'replicate',
      replicateModelId: 'demo-user/portrait-model:abc123',
      huggingfaceRepo: 'demo-user/portrait-model-lora',
      huggingfaceStatus: 'ready',
      loraReadyForInference: true,
      validationStatus: 'valid',
      lastValidationCheck: new Date()
    }
  })

  const styleModel = await prisma.userModel.upsert({
    where: { id: 'demo-style-model' },
    update: {},
    create: {
      id: 'demo-style-model',
      userId: demoUser.id,
      name: 'Artistic Style Model',
      status: 'ready',
      triggerWord: 'ARTISTIC_STYLE',
      trainingImagesCount: 20,
      trainingStartedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
      trainingCompletedAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 1.5 days ago
      externalTrainingId: 'replicate_training_456',
      externalTrainingService: 'replicate',
      replicateModelId: 'demo-user/style-model:def456',
      huggingfaceRepo: 'demo-user/artistic-style-lora',
      huggingfaceStatus: 'ready',
      loraReadyForInference: true,
      validationStatus: 'valid',
      lastValidationCheck: new Date()
    }
  })

  const trainingModel = await prisma.userModel.upsert({
    where: { id: 'demo-training-model' },
    update: {},
    create: {
      id: 'demo-training-model',
      userId: testUser.id,
      name: 'Training Model',
      status: 'training',
      triggerWord: 'TRAINING_SUBJECT',
      trainingImagesCount: 12,
      trainingStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      externalTrainingId: 'replicate_training_789',
      externalTrainingService: 'replicate',
      validationStatus: 'unknown'
    }
  })

  console.log('✅ Created user models:', { 
    portraitModel: portraitModel.id, 
    styleModel: styleModel.id,
    trainingModel: trainingModel.id
  })

  // Create sample training images
  const trainingImages = [
    {
      userModelId: portraitModel.id,
      originalFilename: 'portrait_001.jpg',
      s3Key: '/uploads/training/portrait_001.jpg',
      fileSize: 2048000,
      width: 1024,
      height: 1024
    },
    {
      userModelId: portraitModel.id,
      originalFilename: 'portrait_002.jpg',
      s3Key: '/uploads/training/portrait_002.jpg',
      fileSize: 1856000,
      width: 1024,
      height: 1024
    },
    {
      userModelId: styleModel.id,
      originalFilename: 'style_001.jpg',
      s3Key: '/uploads/training/style_001.jpg',
      fileSize: 3072000,
      width: 1024,
      height: 1024
    }
  ]

  for (const imageData of trainingImages) {
    await prisma.trainingImage.upsert({
      where: { 
        id: `${imageData.userModelId}-${imageData.originalFilename}` 
      },
      update: {},
      create: {
        id: `${imageData.userModelId}-${imageData.originalFilename}`,
        ...imageData
      }
    })
  }

  console.log('✅ Created training images')

  // Create sample generated images
  const generatedImages = [
    {
      id: 'gen-img-001',
      userId: demoUser.id,
      userModelId: portraitModel.id,
      prompt: 'PORTRAIT_PERSON professional headshot, studio lighting, business attire',
      imageUrl: 'https://imagedelivery.net/demo-hash/gen-img-001/public',
      cloudflareImageId: 'gen-img-001',
      width: 1024,
      height: 1024,
      fileSize: 1024000,
      generationDuration: 8500,
      originalTempUrl: 'https://replicate.delivery/temp/gen-img-001.webp',
      generationParams: {
        model: 'demo-user/portrait-model:abc123',
        provider: 'replicate',
        aspectRatio: '1:1',
        steps: 28,
        seed: 12345,
        style: 'professional',
        userModel: {
          id: portraitModel.id,
          name: 'Portrait Model',
          replicateModelId: 'demo-user/portrait-model:abc123',
          triggerWord: 'PORTRAIT_PERSON'
        }
      },
      creditsUsed: 1
    },
    {
      id: 'gen-img-002',
      userId: demoUser.id,
      userModelId: styleModel.id,
      prompt: 'ARTISTIC_STYLE landscape painting, vibrant colors, impressionist style',
      imageUrl: 'https://imagedelivery.net/demo-hash/gen-img-002/public',
      cloudflareImageId: 'gen-img-002',
      width: 1344,
      height: 768,
      fileSize: 1536000,
      generationDuration: 12300,
      originalTempUrl: 'https://replicate.delivery/temp/gen-img-002.webp',
      generationParams: {
        model: 'demo-user/style-model:def456',
        provider: 'replicate',
        aspectRatio: '16:9',
        steps: 30,
        seed: 67890,
        style: 'artistic',
        userModel: {
          id: styleModel.id,
          name: 'Artistic Style Model',
          replicateModelId: 'demo-user/style-model:def456',
          triggerWord: 'ARTISTIC_STYLE'
        }
      },
      creditsUsed: 1
    },
    {
      id: 'gen-img-003',
      userId: demoUser.id,
      userModelId: null,
      prompt: 'A beautiful sunset over mountains, photorealistic, high quality',
      imageUrl: 'https://imagedelivery.net/demo-hash/gen-img-003/public',
      cloudflareImageId: 'gen-img-003',
      width: 1024,
      height: 1024,
      fileSize: 896000,
      generationDuration: 4200,
      originalTempUrl: 'https://api.together.xyz/temp/gen-img-003.jpg',
      generationParams: {
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        provider: 'together-ai',
        aspectRatio: '1:1',
        steps: 4,
        seed: 11111,
        style: 'photorealistic'
      },
      creditsUsed: 1
    },
    {
      id: 'gen-img-004',
      userId: testUser.id,
      userModelId: null,
      prompt: 'Digital art of a futuristic city, neon lights, cyberpunk aesthetic',
      imageUrl: 'https://imagedelivery.net/demo-hash/gen-img-004/public',
      cloudflareImageId: 'gen-img-004',
      width: 768,
      height: 1344,
      fileSize: 1200000,
      generationDuration: 6800,
      originalTempUrl: 'https://api.together.xyz/temp/gen-img-004.jpg',
      generationParams: {
        model: 'black-forest-labs/FLUX.1-dev',
        provider: 'together-ai',
        aspectRatio: '9:16',
        steps: 8,
        seed: 22222,
        style: 'digital_art'
      },
      creditsUsed: 1
    },
    {
      id: 'gen-img-005',
      userId: demoUser.id,
      userModelId: null,
      prompt: 'Minimalist interior design, clean lines, modern furniture',
      imageUrl: 'https://imagedelivery.net/demo-hash/gen-img-005/public',
      cloudflareImageId: 'gen-img-005',
      width: 1152,
      height: 896,
      fileSize: 768000,
      generationDuration: 5500,
      originalTempUrl: 'https://api.together.xyz/temp/gen-img-005.jpg',
      generationParams: {
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        provider: 'together-ai',
        aspectRatio: '4:3',
        steps: 4,
        seed: 33333,
        style: 'minimalist'
      },
      creditsUsed: 1
    }
  ]

  for (const imageData of generatedImages) {
    await prisma.generatedImage.upsert({
      where: { id: imageData.id },
      update: {},
      create: imageData
    })
  }

  console.log('✅ Created generated images')

  // Create sample subscriptions
  await prisma.subscription.upsert({
    where: { id: 'demo-subscription' },
    update: {},
    create: {
      id: 'demo-subscription',
      userId: demoUser.id,
      stripeSubscriptionId: 'sub_demo123',
      planName: 'Pro Monthly',
      status: 'active',
      currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      monthlyCredits: 100
    }
  })

  console.log('✅ Created subscriptions')

  // Create sample credit transactions
  const creditTransactions = [
    {
      userId: demoUser.id,
      amount: 100,
      type: 'subscription_renewal',
      description: 'Monthly Pro subscription renewal',
      relatedEntityType: 'subscription',
      relatedEntityId: 'demo-subscription',
      balanceAfter: 100,
      metadata: { subscriptionPlan: 'pro_monthly' }
    },
    {
      userId: demoUser.id,
      amount: -1,
      type: 'spent',
      description: 'Image generation: PORTRAIT_PERSON professional headshot...',
      relatedEntityType: 'image_generation',
      relatedEntityId: 'gen-img-001',
      balanceAfter: 99,
      metadata: { 
        prompt: 'PORTRAIT_PERSON professional headshot, studio lighting, business attire',
        model: 'demo-user/portrait-model:abc123',
        provider: 'replicate'
      }
    },
    {
      userId: demoUser.id,
      amount: -1,
      type: 'spent',
      description: 'Image generation: ARTISTIC_STYLE landscape painting...',
      relatedEntityType: 'image_generation',
      relatedEntityId: 'gen-img-002',
      balanceAfter: 98,
      metadata: { 
        prompt: 'ARTISTIC_STYLE landscape painting, vibrant colors, impressionist style',
        model: 'demo-user/style-model:def456',
        provider: 'replicate'
      }
    },
    {
      userId: testUser.id,
      amount: 10,
      type: 'earned',
      description: 'Welcome bonus credits',
      relatedEntityType: 'signup_bonus',
      balanceAfter: 10,
      metadata: { reason: 'new_user_welcome' }
    }
  ]

  for (const [index, transactionData] of creditTransactions.entries()) {
    await prisma.creditTransaction.upsert({
      where: { id: `credit-tx-${index + 1}` },
      update: {},
      create: {
        id: `credit-tx-${index + 1}`,
        ...transactionData
      }
    })
  }

  console.log('✅ Created credit transactions')

  // Create sample job queue entries
  await prisma.jobQueue.upsert({
    where: { id: 'job-training-123' },
    update: {},
    create: {
      id: 'job-training-123',
      userId: testUser.id,
      jobType: 'model_training',
      status: 'processing',
      payload: {
        userModelId: trainingModel.id,
        trainingParams: {
          steps: 1000,
          learningRate: 0.0004,
          loraRank: 16
        }
      },
      attempts: 1,
      maxAttempts: 3,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    }
  })

  console.log('✅ Created job queue entries')

  console.log('🎉 Database seeding completed successfully!')
  
  // Print summary
  const userCount = await prisma.user.count()
  const modelCount = await prisma.userModel.count()
  const imageCount = await prisma.generatedImage.count()
  const transactionCount = await prisma.creditTransaction.count()
  
  console.log('\n📊 Seeding Summary:')
  console.log(`   Users: ${userCount}`)
  console.log(`   Models: ${modelCount}`)
  console.log(`   Generated Images: ${imageCount}`)
  console.log(`   Credit Transactions: ${transactionCount}`)
  console.log('\n🔑 Demo Credentials:')
  console.log('   Email: demo@example.com')
  console.log('   Password: password123')
  console.log('   Credits: 50 (Pro user)')
  console.log('\n   Email: test@example.com')
  console.log('   Password: password123')
  console.log('   Credits: 10 (Free user)')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 