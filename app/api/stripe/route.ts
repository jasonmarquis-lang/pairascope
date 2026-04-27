import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import Airtable from 'airtable'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' })
const base   = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { dealId, dealName, depositAmount, projectName, vendorName } = await req.json()
    if (!dealId || !depositAmount) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'

    // Create Stripe payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency:     'usd',
          unit_amount:  Math.round(depositAmount * 100),
          product_data: {
            name:        'Project Deposit',
            description: dealName || (projectName + ' – ' + vendorName),
          },
        },
        quantity: 1,
      }],
      after_completion: {
        type:     'redirect',
        redirect: { url: appUrl + '/rfq-hub?deposit=success' },
      },
      metadata: {
        deal_id:     dealId,
        artist_id:   userData.user.id,
        artist_email: userData.user.email ?? '',
      },
    })

    // Store payment link on Deal record in Airtable
    try {
      if (dealId.startsWith('rec')) {
        await base('Deals').update(dealId, {
          'fldwlsavnJlGOIOji': 'Stripe payment link: ' + paymentLink.url,
        } as Airtable.FieldSet)
      }
    } catch (atErr) {
      console.error('[stripe] Airtable update error:', atErr)
    }

    return NextResponse.json({ url: paymentLink.url, paymentLinkId: paymentLink.id })
  } catch (err) {
    console.error('[/api/stripe] Error:', err)
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 })
  }
}
