#!/usr/bin/env node

/**
 * Test script for Runware NSFW image generation
 *
 * This script sends a single text-to-image request to the Runware REST API
 * with the NSFW filter disabled (checkNSFW: false) so we can verify that
 * explicit prompts are processed correctly. The Runware API key must be
 * available in the RUNWARE_API_KEY environment variable (e.g. loaded from
 * a local .env file).
 *
 * Usage:
 *   RUNWARE_API_KEY=your_key_here node scripts/test-runware-nsfw.js
 *
 * Notes:
 * – The endpoint used here (https://api.runware.ai/v1/inference) is based
 *   on the official Runware documentation. If the API version changes,
 *   update RUNWARE_API_ENDPOINT below.
 * – The script uses the built-in fetch that ships with Node 18+. If you are
 *   using an older Node version make sure `node-fetch` is installed and
 *   uncomment the dynamic import at the top of the file.
 */

import { randomUUID } from 'crypto'
import 'dotenv/config'

// If your Node version <18 you can uncomment the next line
// const fetch = (await import('node-fetch')).default

const RUNWARE_API_ENDPOINT = 'https://api.runware.ai/v1/inference'
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY

if (!RUNWARE_API_KEY) {
  console.error('❌ RUNWARE_API_KEY environment variable is not set.')
  console.error('   Export it or add it to your .env file.')
  process.exit(1)
}

async function testRunwareNSFW() {
  console.log('🧪 Testing Runware NSFW image generation…')

  const requestBody = [
    {
      taskType: 'imageInference',
      taskUUID: randomUUID(),
      positivePrompt: `A beautiful woman with long flowing hair stands in a room filled with books. Her clothes are off, and she has a confident smile on her face. The books are stacked high, and she holds a book in her hand, looking excited to read. The scene is soft and serene, with a hint of a sexual vibe. The woman's body is attractive, and her nakedness is tasteful and natural. The background is a cozy room with soft lighting, creating a relaxing atmosphere. The image should capture the woman's allure and confidence, with a touch of sensuality.`,
      model: 'runware:101@1', // FLUX base model (photorealistic)
      width: 1024,
      height: 768,
      steps: 30,
      CFGScale: 7,
      checkNSFW: false, // Disable NSFW check – allow adult content
      numberResults: 1,
      outputType: 'URL'
    }
  ]

  try {
    const response = await fetch(RUNWARE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RUNWARE_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      console.error(`❌ Request failed with status ${response.status}`)
      const errorText = await response.text()
      console.error(errorText)
      process.exit(1)
    }

    const data = await response.json()
    const firstTask = data?.data?.[0]

    if (firstTask?.imageURL) {
      console.log('✅ Image generation task accepted!')
      console.log('   Image URL:', firstTask.imageURL)
      console.log('   Task UUID:', firstTask.taskUUID)
      console.log('   Model:', requestBody[0].model)
    } else {
      console.log('⚠️  No imageURL returned – response:', JSON.stringify(data, null, 2))
    }
  } catch (err) {
    console.error('❌ Error while calling Runware API:', err)
    process.exit(1)
  }
}

// Run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRunwareNSFW()
} 