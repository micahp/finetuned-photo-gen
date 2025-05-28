import { NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'

// POST /api/generate-prompt
export async function POST() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
        messages: [
          {
            role: 'system',
            content: 'You are a creative AI that generates unique, detailed image prompts. Create vivid, descriptive prompts that would work well for AI image generation. Focus on interesting subjects, lighting, composition, and style. Keep prompts between 10-30 words and make them creative and engaging.'
          },
          {
            role: 'user',
            content: 'Generate a creative and detailed prompt for AI image generation. Make it unique and interesting.'
          }
        ],
        max_tokens: 100,
        temperature: 0.9,
        top_p: 0.9,
        stop: ['\n', '.', '!', '?']
      })
    })

    if (!response.ok) {
      throw new Error(`Together AI API error: ${response.status}`)
    }

    const data = await response.json()
    const generatedPrompt = data.choices?.[0]?.message?.content?.trim()

    if (!generatedPrompt) {
      throw new Error('No prompt generated')
    }

    return NextResponse.json({
      success: true,
      prompt: generatedPrompt
    })

  } catch (error) {
    console.error('Generate prompt error:', error)
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    )
  }
} 