import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'
import { CREDIT_PACKS } from '@/lib/stripe/pricing'

const createPhotoPackCheckoutSchema = z.object({
  packId: z.string().min(1, { message: 'Pack ID is required' }),
  returnUrl: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = session.user.id
    const userEmail = session.user.email

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const validation = createPhotoPackCheckoutSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]?.message }, { status: 400 })
    }

    const { packId, returnUrl } = validation.data

    const pack = CREDIT_PACKS.find(p => p.id === packId)
    if (!pack) {
      return NextResponse.json({ error: `Pack not found: ${packId}` }, { status: 400 })
    }
    if (!pack.priceId) {
      return NextResponse.json({ error: `No Stripe price ID configured for ${packId}` }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const successUrl = returnUrl
      ? `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&purchase=success`
      : `${baseUrl}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&purchase=success&refresh=true`
    const cancelUrl = returnUrl || `${baseUrl}/dashboard/billing?canceled=true`

    const checkoutSession = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: pack.priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      metadata: {
        userId,
        credits_purchased: pack.credits.toString(),
        packId: pack.id,
        packName: pack.name,
      },
      payment_intent_data: {
        metadata: {
          userId,
          credits_purchased: pack.credits.toString(),
          packId: pack.id,
        },
      },
    })

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { sessionId: checkoutSession.id, url: checkoutSession.url },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error creating photo pack checkout:', error)
    if (error?.type?.startsWith('Stripe')) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: error.statusCode || 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
