import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'
import * as postmark from 'postmark'

const base      = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)
const pmClient  = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? 'POSTMARK_API_TEST')
const FROM      = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
const ADMIN     = process.env.ADMIN_EMAIL ?? 'jasonmarquis@gmail.com'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId    = searchParams.get('rfqId')
    const vendorId = searchParams.get('vendorId')

    if (rfqId) {
      // Single RFQ detail + existing bid for this vendor
      const authHeader = req.headers.get('authorization')
      let currentVendorId: string | null = null
      if (authHeader?.startsWith('Bearer ')) {
        const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
        currentVendorId = data.user?.id ?? null
      }

      // Get RFQ from Supabase
      const { data: rfq } = await supabaseAdmin
        .from('rfqs')
        .select('*')
        .eq('id', rfqId)
        .single()

      // Get existing bid if any
      let bid = null
      if (currentVendorId) {
        const { data: bidData } = await supabaseAdmin
          .from('bids')
          .select('*')
          .eq('rfq_id', rfqId)
          .eq('vendor_id', currentVendorId)
          .single()
        bid = bidData
      }

      return NextResponse.json({ rfq, bid })
    }

    if (vendorId) {
      // All RFQs for this vendor — look up by vendor_ids array
      const { data: rfqs } = await supabaseAdmin
        .from('rfqs')
        .select('*')
        .contains('vendor_ids', [vendorId])
        .order('created_at', { ascending: false })

      // Get all bids for this vendor
      const { data: bids } = await supabaseAdmin
        .from('bids')
        .select('rfq_id')
        .eq('vendor_id', vendorId)

      const submittedRfqIds = new Set((bids ?? []).map((b) => b.rfq_id))

      const rfqsWithBidStatus = (rfqs ?? []).map((rfq) => ({
        ...rfq,
        bid_submitted: submittedRfqIds.has(rfq.id),
      }))

      return NextResponse.json({ rfqs: rfqsWithBidStatus })
    }

    return NextResponse.json({ rfqs: [] })
  } catch (err) {
    console.error('[/api/bids] GET error:', err)
    return NextResponse.json({ rfqs: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    const vendorId   = userData.user?.id
    const vendorEmail = userData.user?.email
    if (!vendorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rfqId, priceLow, priceHigh, timeline, assumptions, notes } = await req.json()
    if (!rfqId || !timeline) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    // Get vendor name from Airtable
    let vendorName = vendorEmail ?? 'Vendor'
    try {
      const vendors = await base('Vendors')
        .select({ filterByFormula: `{Email} = "${vendorEmail}"`, maxRecords: 1, fields: ['Vendor Name'] })
        .all()
      if (vendors[0]) vendorName = vendors[0].get('Vendor Name') as string || vendorName
    } catch { /* use email as fallback */ }

    // Get RFQ details
    const { data: rfq } = await supabaseAdmin.from('rfqs').select('*').eq('id', rfqId).single()

    // Save bid to Supabase
    const { data: bid, error: bidError } = await supabaseAdmin
      .from('bids')
      .upsert({
        rfq_id:      rfqId,
        vendor_id:   vendorId,
        vendor_name: vendorName,
        price_low:   priceLow ?? null,
        price_high:  priceHigh ?? null,
        timeline,
        assumptions: assumptions || null,
        notes:       notes || null,
        status:      'Submitted',
      }, { onConflict: 'rfq_id,vendor_id' })
      .select()
      .single()

    if (bidError) throw bidError

    // Save to Airtable Responses table
    try {
      await base('Responses').create({
        'RFQ ID':       rfqId,
        'Vendor Name':  vendorName,
        'Price Low':    priceLow ?? 0,
        'Price High':   priceHigh ?? 0,
        'Timeline':     timeline,
        'Assumptions':  assumptions || '',
        'Notes':        notes || '',
        'Status':       'Submitted',
      } as Airtable.FieldSet)
    } catch (airtableErr) {
      console.error('[/api/bids] Airtable error:', airtableErr)
    }

    // Update vendor status in RFQ record
    try {
      const currentStatuses = rfq?.vendor_statuses ?? {}
      const updatedStatuses = { ...currentStatuses, [vendorName]: 'Responded' }
      await supabaseAdmin.from('rfqs').update({ vendor_statuses: updatedStatuses }).eq('id', rfqId)
    } catch (statusErr) {
      console.error('[/api/bids] Status update error:', statusErr)
    }

    // Notify artist via email
    try {
      const priceText = (priceLow && priceHigh)
        ? `$${Number(priceLow).toLocaleString()} \u2013 $${Number(priceHigh).toLocaleString()}`
        : 'Not specified'

      await pmClient.sendEmail({
        From:    FROM,
        To:      ADMIN,
        Subject: `[Pairascope] New estimate received \u2013 ${rfq?.project_name || 'Your project'}`,
        TextBody: `Hi,\n\n${vendorName} has submitted an estimate for your project "${rfq?.project_name || 'Art Project'}".\n\nESTIMATE DETAILS\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nVendor: ${vendorName}\nPrice Range: ${priceText}\nTimeline: ${timeline}${assumptions ? '\n\nAssumptions:\n' + assumptions : ''}${notes ? '\n\nNotes:\n' + notes : ''}\n\nView your RFQ dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}/rfq-hub\n\nBest,\nPairascope`,
      })
    } catch (emailErr) {
      console.error('[/api/bids] Notification email error:', emailErr)
    }

    return NextResponse.json({ success: true, bid })
  } catch (err) {
    console.error('[/api/bids] POST error:', err)
    return NextResponse.json({ error: 'Failed to submit bid' }, { status: 500 })
  }
}
