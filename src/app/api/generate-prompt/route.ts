import { NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { fetchWithRetry } from '@/lib/fetch-with-retry'

// POST /api/generate-prompt
export async function POST() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetchWithRetry('https://api.together.xyz/v1/chat/completions', {
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
            content: `You are PromptSmith, an expert at crafting imaginative image-generation prompts.

Guidelines:
• 20-35 words.
• Evoke vivid subjects, cinematic lighting, and evocative atmosphere.
• Include 1-2 art-style or lens keywords (e.g. "neon cyberpunk", "50 mm bokeh").
• No camera brands. No artist names. No quoted text.`
          },
          {
            role: 'user',
            content: 'Give me one fresh, exciting prompt.'
          }
        ],
        max_tokens: 120,
        temperature: 1,
        top_p: 0.95
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

  } catch (error: any) {
    console.error('Generate prompt error:', error)
    const message = typeof error?.message === 'string' ? error.message : ''
    const serviceUnavailable = message.includes('status 503')
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: serviceUnavailable ? 503 : 500 }
    )
  }
} 