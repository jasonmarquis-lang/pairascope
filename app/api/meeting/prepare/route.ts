export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'
import { buildGoogleCalendarUrl } from '@/app/lib/meetingUrl'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

export async function POST(req: NextRequest) {
  try {
    const { rfqId, vendorId } = await req.json()

    if (!rfqId) {
      return NextResponse.json(
        { error: 'rfqId is required' },
        { status: 400 }
      )
    }

    // Fetch RFQ
    const rfqRecord     = await getBase()('RFQs').find(rfqId)
    const rfqTitle      = rfqRecord.get('RFQ Title')      as string || 'Untitled RFQ'
    const scopeDocument = rfqRecord.get('Scope Document') as string || ''

    // Fetch linked Project name
    const linkedProjects = rfqRecord.get('Linked Project') as string[] | undefined
    let projectName = 'Your Project'
    if (linkedProjects && linkedProjects.length > 0) {
      const projectRecord = await getBase()('Projects').find(linkedProjects[0])
      projectName = projectRecord.get('Project Name') as string || 'Your Project'
    }

    // Resolve vendor email
    // Case A: called from RFQ Hub with explicit vendorId (artist scheduling on behalf)
    // Case B: called from Vendor Portal — resolve from auth token
    let vendorEmail = ''

    if (vendorId) {
      const vendorRecord = await getBase()('Vendors').find(vendorId)
      vendorEmail = vendorRecord.get('Email') as string || ''
    } else {
      // Resolve from bearer token
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabaseAdmin.auth.getUser(token)
        if (user?.email) {
          // Look up vendor by email in Airtable
          const vendors = await getBase()('Vendors')
            .select({ filterByFormula: `{Email} = "${user.email}"`, maxRecords: 1 })
            .all()
          vendorEmail = vendors[0]?.get('Email') as string || user.email
        }
      }
    }

    if (!vendorEmail) {
      return NextResponse.json(
        { error: 'Could not resolve vendor email' },
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
