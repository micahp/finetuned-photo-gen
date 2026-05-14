import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const subscribeSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  source: z.enum(['landing_page', 'exit_intent', 'footer', 'checkout']).default('landing_page'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = subscribeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { email, source } = validation.data

    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    })

    if (existing) {
      if (existing.subscribed) {
        return NextResponse.json(
          { message: 'You are already subscribed!' },
          { status: 200 }
        )
      }
      // Re-subscribe
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: { subscribed: true, source },
      })
      return NextResponse.json(
        { message: 'Welcome back! You have been re-subscribed.' },
        { status: 200 }
      )
    }

    await prisma.newsletterSubscriber.create({
      data: { email, source },
    })

    return NextResponse.json(
      { message: 'Successfully subscribed to the Innovative Hype newsletter!' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Newsletter subscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    )
  }
}
