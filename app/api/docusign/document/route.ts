export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const bidId = searchParams.get('bidId')
    if (!bidId) return NextResponse.json({ error: 'Missing bidId' }, { status: 400 })

    const base      = getBase()
    const bidRecord = await base('Bids').find(bidId)
    const dealIds   = bidRecord.get('Deal') as string[] | undefined
    if (!dealIds?.length) return NextResponse.json({ error: 'No deal found' }, { status: 404 })

    const dealRecord   = await base('Deals').find(dealIds[0])
    const attachments  = dealRecord.get('Signed Agreement') as { url: string; filename: string }[] | undefined
    if (!attachments?.length) return NextResponse.json({ error: 'No signed agreement found' }, { status: 404 })

    const att = attachments[0]
    const res = await fetch(att.url)
    if (!res.ok) return NextResponse.json({ error: 'Could not fetch document' }, { status: 500 })

    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'attachment; filename="signed-agreement.pdf"',
      },
    })
  } catch (err) {
    console.error('[docusign/document]', err)
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}
