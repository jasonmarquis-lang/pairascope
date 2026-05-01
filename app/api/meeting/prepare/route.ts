import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { buildGoogleCalendarUrl } from '@/app/lib/meetingUrl'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!)

export async function POST(req: NextRequest) {
  try {
    const { rfqId, vendorId } = await req.json()

    if (!rfqId || !vendorId) {
      return NextResponse.json(
        { error: 'rfqId and vendorId are required' },
        { status: 400 }
      )
    }

    // Fetch RFQ
    const rfqRecord     = await base('RFQs').find(rfqId)
    const rfqTitle      = rfqRecord.get('RFQ Title')      as string || 'Untitled RFQ'
    const scopeDocument = rfqRecord.get('Scope Document') as string || ''

    // Fetch linked Project name
    const linkedProjects = rfqRecord.get('Linked Project') as string[] | undefined
    let projectName = 'Your Project'
    if (linkedProjects && linkedProjects.length > 0) {
      const projectRecord = await base('Projects').find(linkedProjects[0])
      projectName = projectRecord.get('Project Name') as string || 'Your Project'
    }

    // Fetch vendor email from Vendors table
    const vendorRecord = await base('Vendors').find(vendorId)
    const vendorEmail  = vendorRecord.get('Email') as string || ''

    if (!vendorEmail) {
      return NextResponse.json(
        { error: 'No email found for this vendor' },
        { status: 400 }
      )
    }

    const calendarUrl = buildGoogleCalendarUrl({
      projectName,
      rfqTitle,
      scopeDocument,
      vendorEmail,
    })

    return NextResponse.json({ calendarUrl })

  } catch (err) {
    console.error('[meeting/prepare]', err)
    return NextResponse.json(
      { error: 'Failed to prepare meeting URL' },
      { status: 500 }
    )
  }
}
