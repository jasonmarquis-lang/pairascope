import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2026-04-22.dahlia' })

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { dealId, dealName, depositAmount, projectName, vendorName } = await req.json()
    if (!dealId || !depositAmount) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'
    const userId      = userData.user.id
    const userEmail   = userData.user.email ?? ''
    const description = dealName || (projectName + ' - ' + vendorName)

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency:     'usd',
          unit_amount:  Math.round(Number(depositAmount) * 100),
          product_data: { name: 'Project Deposit', description },
        },
        quantity: 1,
      }],
      after_completion: {
        type:     'redirect',
        redirect: { url: appUrl + '/rfq-hub?deposit=success' },
      },
      metadata: { deal_id: dealId, artist_id: userId, artist_email: userEmail },
    })

    const linkId  = paymentLink.id
    const linkUrl = paymentLink.url
    return NextResponse.json({ url: linkUrl, paymentLinkId: linkId })
  } catch (err) {
    console.error('[/api/stripe] Error:', err)
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 })
  }
}
