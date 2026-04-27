import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import Airtable from 'airtable'
import * as postmark from 'postmark'

const stripe    = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' })
const base      = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)
const pmClient  = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')
const FROM      = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
const ADMIN     = process.env.ADMIN_EMAIL ?? 'admin@pairascope.com'

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
    const session  = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent
    const metadata = session.metadata ?? {}
    const dealId   = metadata.deal_id
    const artistEmail = metadata.artist_email

    if (dealId?.startsWith('rec')) {
      try {
        const today = new Date().toISOString().split('T')[0]
        await base('Deals').update(dealId, {
          'fldpA7q8k3G8R3Lla': 'Contract Secured',
          'fldw1q6Jj3zCQexsE': today,
        } as Airtable.FieldSet)

        // Notify admin
        await pmClient.sendEmail({
          From:     FROM,
          To:       ADMIN,
          Subject:  '[Pairascope] Deposit received',
          TextBody: 'A deposit has been received for deal ' + dealId + '.\n\nArtist: ' + artistEmail + '\n\nThe deal has been moved to Contract Secured.',
        })
      } catch (err) {
        console.error('[stripe/webhook] Airtable update error:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
