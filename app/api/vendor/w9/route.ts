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
    const vendorId = searchParams.get('vendorId')
    if (!vendorId) return NextResponse.json({ error: 'Missing vendorId' }, { status: 400 })

    const base         = getBase()
    const vendorRecord = await base('Vendors').find(vendorId)
    const attachments  = vendorRecord.get('W9') as { url: string; filename: string }[] | undefined

    if (!attachments?.length) return NextResponse.json({ error: 'No W9 found' }, { status: 404 })

    const att = attachments[0]
    const res = await fetch(att.url)
    if (!res.ok) return NextResponse.json({ error: 'Could not fetch W9' }, { status: 500 })

    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${att.filename}"`,
      },
    })
  } catch (err) {
    console.error('[vendor/w9]', err)
    return NextResponse.json({ error: 'Failed to fetch W9' }, { status: 500 })
  }
}
