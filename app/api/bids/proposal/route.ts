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

    const record      = await getBase()('Bids').find(bidId)
    const attachments = record.get('Proposal File') as { url: string; filename: string }[] | undefined
    if (!attachments?.length) {
      return NextResponse.json({ error: 'No proposal file found' }, { status: 404 })
    }

    const att     = attachments[0]
    const fileRes = await fetch(att.url)
    if (!fileRes.ok) return NextResponse.json({ error: 'Failed to fetch file' }, { status: 502 })

    const buf = await fileRes.arrayBuffer()
    return new NextResponse(buf, {
      headers: {
        'Content-Type':        fileRes.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${att.filename}"`,
      },
    })
  } catch (err) {
    console.error('[/api/bids/proposal] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch proposal' }, { status: 500 })
  }
}
