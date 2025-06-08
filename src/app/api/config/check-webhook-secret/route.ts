import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Only allow this endpoint in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'This endpoint is only available in development mode' }, { status: 403 });
  }

  // Check if the webhook secret is set
  const webhookSecretSet = !!process.env.STRIPE_WEBHOOK_SECRET;

  // Return the result without exposing the actual secret
  return NextResponse.json({ webhookSecretSet });
} 