import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'
import { getAccountIdByEmail } from '@/lib/airtable'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    const artistEmail = userData.user?.email
    if (!artistEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rfqId, vendorName, bidId, projectName, priceAccepted } = await req.json()
    if (!rfqId || !vendorName) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const accountId = await getAccountIdByEmail(artistEmail)
    const { data: rfqData } = await supabaseAdmin.from('rfqs').select('*').eq('id', rfqId).single()

    // Find Airtable Project record
    let airtableProjectId: string | null = null
    if (rfqData?.conversation_id) {
      const projects = await base('Projects')
        .select({ filterByFormula: '{Supabase Conversation ID} = "' + rfqData.conversation_id + '"', maxRecords: 1 })
        .all()
      airtableProjectId = projects[0]?.getId() ?? null
    }

    // Find Airtable RFQ record
    const airtableRfqId = rfqId.startsWith('rec') ? rfqId : null

    // Find Airtable Vendor record
    let airtableVendorId: string | null = null
    const vendors = await base('Vendors')
      .select({ filterByFormula: '{Vendor Name} = "' + vendorName + '"', maxRecords: 1 })
      .all()
    airtableVendorId = vendors[0]?.getId() ?? null

    const dealName = (projectName || rfqData?.project_name || 'Project') + ' – ' + vendorName
    const dealFields: Airtable.FieldSet = {
      'fldmcMDKoZRcgMznK': dealName,
      'fldpA7q8k3G8R3Lla': 'Vendor Selected',
    }
    if (airtableProjectId) dealFields['fldvWaWR2UsWB4qtH'] = [airtableProjectId]
    if (airtableVendorId)  dealFields['fldf36mVgc6xidu3O'] = [airtableVendorId]
    if (airtableRfqId)     dealFields['fldY2VJ9R8q2WZrrT'] = [airtableRfqId]
    if (accountId)         dealFields['fldZNdJQQnj6OoiMT'] = [accountId]
    if (priceAccepted)     dealFields['fldD5PPED9xwdlaIJ'] = priceAccepted
    // Look up Airtable bid record by vendor name + RFQ
    try {
      if (airtableVendorId) {
        const airtableBids = await base('Bids')
          .select({ filterByFormula: '{Vendor} = "' + (airtableVendorId ? airtableVendorId : '') + '"', maxRecords: 1 })
          .all()
        const airtableBidId = airtableBids[0]?.getId()
        if (airtableBidId) dealFields['fldrQyq8LhR2pf51e'] = [airtableBidId]
      }
    } catch (bidLookupErr) {
      console.error('[deals] Bid lookup error:', bidLookupErr)
    }

    const dealRecord = await base('Deals').create(dealFields)
    const dealId = dealRecord.getId()

    // Update Project status to Awarded
    if (airtableProjectId) {
      await base('Projects').update(airtableProjectId, { 'fldLdWTW2uHq4fP0m': 'Awarded' } as Airtable.FieldSet).catch(() => {})
    }

    // Update RFQ status to Closed
    if (airtableRfqId) {
      await base('RFQs').update(airtableRfqId, {
        'fldU6tXgnTD9QZhZI': 'Closed',
        'fldvHkQ4WoWXgupt8': [dealId],
      } as Airtable.FieldSet).catch(() => {})
    }

    // Update Supabase RFQ status
    await supabaseAdmin.from('rfqs').update({
      status: 'Closed',
      vendor_statuses: { ...(rfqData?.vendor_statuses ?? {}), [vendorName]: 'Selected' },
    }).eq('id', rfqId)

    return NextResponse.json({ success: true, dealId, dealName })
  } catch (err) {
    console.error('[/api/deals] Error:', err)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
}
