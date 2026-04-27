export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import * as postmark from 'postmark'

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' })
const pmClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')
const FROM     = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
const ADMIN    = process.env.ADMIN_EMAIL ?? 'admin@pairascope.com'

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const obj      = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent
    const metadata = obj.metadata ?? {}
    const dealId   = metadata.deal_id
    const artistEmail = metadata.artist_email

    if (dealId) {
      try {
        // Update Deal via Airtable through a separate internal call
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'
        await fetch(appUrl + '/api/deals/complete', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.STRIPE_WEBHOOK_SECRET ?? '' },
          body:    JSON.stringify({ dealId, artistEmail }),
        })
      } catch (err) {
        console.error('[stripe/webhook] Deal completion error:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
