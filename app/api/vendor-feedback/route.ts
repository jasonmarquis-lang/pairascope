export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

async function getVendorAirtableId(vendorName: string): Promise<string | null> {
  try {
    const records = await getBase()('Vendors')
      .select({ filterByFormula: `{Vendor Name} = "${vendorName}"`, maxRecords: 1 })
      .all()
    return records[0]?.getId() ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { vendorId, vendorName, action, reason, projectType, projectId } = await req.json()

    const fields: Airtable.FieldSet = {
      'fldFzGPSwvHWJ04uS': `${vendorName} \u2013 ${action} \u2013 ${new Date().toLocaleDateString()}`,
      'fldFeJdKwuhNdvktQ': action === 'included' ? 'Included' : action === 'excluded' ? 'Excluded' : action || '',
      'fldzkYfTxHu0NrFC6': reason       || '',
      'fldCcdmCGA6h2rCJb': projectType  || '',
      'fld0v8dzOa1yVpqzH': new Date().toISOString(),
      'fldWlqWxyGHHmDj5e': vendorId     || '',
    }

    // Look up vendor Airtable record ID and link it
    if (vendorName) {
      const airtableVendorId = await getVendorAirtableId(vendorName)
      if (airtableVendorId) {
        fields['fldd73266puVP8x4j'] = [airtableVendorId]
      }
    }

    // Link project if provided
    if (projectId) {
      fields['fldcvHhdeLHmkS3PH'] = [projectId]
    }

    await getBase()('Vendor Feedback').create(fields)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/vendor-feedback] Error:', JSON.stringify(err))
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
