#!/usr/bin/env node

/**
 * Generate AI Descriptions for Demo Library Images
 * 
 * This script uses Together AI's text generation API to create better,
 * more descriptive alt text for the demo library images.
 */

const fs = require('fs').promises
const path = require('path')
require('dotenv').config()

class TogetherTextService {
  constructor() {
    this.apiKey = process.env.TOGETHER_API_KEY
    this.baseUrl = 'https://api.together.xyz/v1'
    
    if (!this.apiKey) {
      throw new Error('TOGETHER_API_KEY environment variable is required')
    }
  }

  async generateText(prompt, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options.maxTokens || 150,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        stop: options.stop || null
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Together AI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content?.trim() || ''
  }
}

// Current demo items from the file
const demoItems = [
  {
    id: '1',
    src: 'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=800&q=60',
    alt: 'Portrait in neon lighting',
    category: 'portrait'
  },
  {
    id: '2',
    src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=60',
    alt: 'Landscape city at night',
    category: 'landscape'
  },
  {
    id: '3',
    src: 'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=800&q=60',
    alt: 'Artistic abstract colors',
    category: 'artistic'
  },
  {
    id: '4',
    src: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=60',
    alt: 'Professional business headshot',
    category: 'professional'
  },
  {
    id: '5',
    src: 'https://images.unsplash.com/photo-1504208434309-cb69f4fe52b0?auto=format&fit=crop&w=800&q=60',
    alt: 'Casual street style',
    category: 'casual'
  },
  {
    id: '6',
    src: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=60',
    alt: 'Outdoor adventure scene',
    category: 'outdoor'
  },
  {
    id: '7',
    src: 'https://images.unsplash.com/photo-1454023492550-5696f8ff10e1?auto=format&fit=crop&w=800&q=60',
    alt: 'Vintage cinematic still',
    category: 'vintage'
  },
  {
    id: '8',
    src: '/images/flux-dev.webp',
    alt: 'Flux Dev Model',
    category: 'featured'
  },
  {
    id: '9',
    src: '/images/flux-pro-ultra.webp',
    alt: 'Flux Pro Ultra Model',
    category: 'featured'
  },
  {
    id: '10',
    src: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=60',
    alt: 'Colorful festival scene',
    category: 'colorful'
  },
  {
    id: '11',
    src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=60',
    alt: 'Monochrome architecture shot',
    category: 'monochrome'
  },
  {
    id: '12',
    src: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=60',
    alt: 'Fantasy landscape',
    category: 'fantasy'
  }
]

// Description generation prompts for different categories
function createDescriptionPrompt(currentAlt, category, isLocalImage = false) {
  if (isLocalImage) {
    // For local Flux model images, we don't have access to the actual image content
    // so we'll generate descriptions based on the model names
    if (currentAlt.includes('Flux Dev')) {
      return `Create an inspiring, detailed description for a demo image showcasing Flux Dev model capabilities. 
      Focus on photorealistic quality, technical excellence, and creative potential. 
      Make it 10-15 words that would inspire users to try the model. 
      Current description: "${currentAlt}". Category: ${category}.
      
      Return only the new description, no quotes or extra text.`
    } else if (currentAlt.includes('Flux Pro Ultra')) {
      return `Create an inspiring, detailed description for a demo image showcasing Flux Pro Ultra model capabilities. 
      Focus on ultra-high quality, professional results, and cutting-edge AI technology. 
      Make it 10-15 words that would inspire users to try the model. 
      Current description: "${currentAlt}". Category: ${category}.
      
      Return only the new description, no quotes or extra text.`
    }
  }

  return `Create a more detailed, inspiring description for a demo image gallery. 
  The current description is: "${currentAlt}"
  Category: ${category}
  
  Requirements:
  - 8-12 words maximum
  - Inspiring and descriptive
  - Perfect for accessibility (alt text)
  - Should make users want to create similar images
  - Focus on visual details and artistic qualities
  - Don't use quotes around the description
  
  Return only the new description, no quotes or extra text.`
}

async function generateDescriptions() {
  console.log('🎨 Generating AI descriptions for demo library images...\n')

  try {
    const textService = new TogetherTextService()
    const updatedItems = []

    for (const item of demoItems) {
      console.log(`📝 Generating description for item ${item.id} (${item.category})...`)
      console.log(`   Current: "${item.alt}"`)
      
      const isLocalImage = item.src.startsWith('/images/')
      const prompt = createDescriptionPrompt(item.alt, item.category, isLocalImage)
      
      try {
        const newDescription = await textService.generateText(prompt, {
          maxTokens: 50,
          temperature: 0.8,
          model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo'
        })
        
        // Clean up the response (remove quotes if present)
        const cleanDescription = newDescription.replace(/^["']|["']$/g, '').trim()
        
        updatedItems.push({
          ...item,
          alt: cleanDescription
        })
        
        console.log(`   New:     "${cleanDescription}"`)
        console.log('')
        
        // Add a small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.warn(`   ⚠️ Failed to generate description for item ${item.id}: ${error.message}`)
        console.log(`   Keeping original: "${item.alt}"`)
        
        // Keep the original item if generation fails
        updatedItems.push(item)
        console.log('')
      }
    }

    // Generate the updated TypeScript file content
    const fileContent = `export interface DemoItem {
  id: string
  src: string
  alt: string
  category: string
}

// Updated demo items with AI-generated descriptions
export const demoItems: DemoItem[] = [
${updatedItems.map(item => `  {
    id: '${item.id}',
    src: '${item.src}',
    alt: '${item.alt}',
    category: '${item.category}'
  }`).join(',\n')}
] 
`

    // Write the updated file
    const filePath = path.join(process.cwd(), 'src/components/landing/demo-items.ts')
    await fs.writeFile(filePath, fileContent)
    
    console.log('✅ Successfully updated demo-items.ts with AI-generated descriptions!')
    console.log(`📁 File saved to: ${filePath}`)
    
    // Show summary
    console.log('\n📊 Summary:')
    console.log(`   📝 Total items processed: ${demoItems.length}`)
    console.log(`   ✅ Successfully updated: ${updatedItems.length}`)
    console.log(`   ⚠️ Failed generations: ${demoItems.length - updatedItems.length}`)
    
    console.log('\n🎉 Description generation completed!')
    
  } catch (error) {
    console.error('❌ Script failed:', error.message)
    process.exit(1)
  }
}

// Environment check
function checkEnvironment() {
  const required = ['TOGETHER_API_KEY']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '))
    console.error('   Please set TOGETHER_API_KEY in your .env file')
    process.exit(1)
  }
  
  console.log('✅ Environment variables configured')
}

// Run the script
if (require.main === module) {
  console.log('🔧 Checking environment...')
  checkEnvironment()
  console.log('')
  
  generateDescriptions()
    .then(() => {
      console.log('\n✅ Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error)
      process.exit(1)
    })
}

module.exports = { generateDescriptions } 