export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import * as postmark from 'postmark'

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-webhook-secret')
    if (secret !== process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { dealId, artistEmail } = await req.json()
    const base     = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)
    const pmClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')
    const FROM     = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
    const ADMIN    = process.env.ADMIN_EMAIL ?? 'admin@pairascope.com'
    const today    = new Date().toISOString().split('T')[0]

    if (dealId?.startsWith('rec')) {
      await base('Deals').update(dealId, {
        'fldpA7q8k3G8R3Lla': 'Contract Secured',
        'fldw1q6Jj3zCQexsE': today,
      } as Airtable.FieldSet)
    }

    await pmClient.sendEmail({
      From:     FROM,
      To:       ADMIN,
      Subject:  '[Pairascope] Deposit received',
      TextBody: 'A deposit has been received for deal ' + dealId + '.\n\nArtist: ' + artistEmail + '\n\nDeal moved to Contract Secured.',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/deals/complete] Error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
