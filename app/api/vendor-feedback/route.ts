import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

export async function POST(req: NextRequest) {
  try {
    const { vendorId, vendorName, action, reason, projectType } = await req.json()
    const today = new Date().toISOString()

    await base('Vendor Feedback').create({
      'Feedback Name': `${vendorName} \u2013 ${action} \u2013 ${new Date().toLocaleDateString()}`,
      'Vendor':        [{ id: vendorId }] as unknown as string[],
      'Action':        action,
      'Reason':        reason || '',
      'Project Type':  projectType || '',
      'Date':          today,
    } as Airtable.FieldSet)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/vendor-feedback] Error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
