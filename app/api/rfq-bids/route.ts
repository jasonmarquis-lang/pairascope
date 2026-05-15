export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Airtable from 'airtable'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

// Look up Airtable Bid record IDs by vendor name.
// "Vendor Name" field confirmed present from docusign/complete usage.
// If rfqId is an Airtable record ID (starts with 'rec'), also filter by RFQ link for precision.
async function enrichWithAirtableBidIds(
  bids: Record<string, unknown>[],
  rfqId: string,
): Promise<Record<string, unknown>[]> {
  if (!bids.length) return bids
  const vendorNames = bids.map((b) => (b.vendor_name as string) ?? '').filter(Boolean)
  if (!vendorNames.length) return bids.map((b) => ({ ...b, airtable_bid_id: null }))

  try {
    const vendorClauses = vendorNames.map((n) => `{Vendor Name} = "${n.replace(/"/g, '\\"')}"`)
    const vendorFilter  = vendorClauses.length === 1 ? vendorClauses[0] : `OR(${vendorClauses.join(', ')})`

    const formula = rfqId.startsWith('rec')
      ? `AND(${vendorFilter}, FIND("${rfqId}", ARRAYJOIN({RFQ})) > 0)`
      : vendorFilter

    const records = await getBase()('Bids').select({
      filterByFormula: formula,
      fields:          ['Vendor Name'],
      maxRecords:      20,
    }).all()

    const airtableIdByVendor: Record<string, string> = {}
    for (const r of records) {
      const vn = (r.get('Vendor Name') as string ?? '').toLowerCase()
      if (vn) airtableIdByVendor[vn] = r.getId()
    }

    return bids.map((b) => ({
      ...b,
      airtable_bid_id: airtableIdByVendor[(b.vendor_name as string ?? '').toLowerCase()] ?? null,
    }))
  } catch (err) {
    console.error('[rfq-bids] Airtable enrichment error:', err)
    return bids.map((b) => ({ ...b, airtable_bid_id: null }))
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId = searchParams.get('rfqId')
    if (!rfqId) return NextResponse.json({ bids: [] })

    // Try direct match first
    const { data: bids } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('rfq_id', rfqId)
      .order('created_at', { ascending: true })

    if (bids && bids.length > 0) {
      const enriched = await enrichWithAirtableBidIds(bids as Record<string, unknown>[], rfqId)
      return NextResponse.json({ bids: enriched })
    }

    // Fallback: find the RFQ vendor_names and look up bids by vendor name + matching RFQ
    const { data: rfq } = await supabaseAdmin
      .from('rfqs')
      .select('vendor_names, project_id')
      .eq('id', rfqId)
      .single()

    if (rfq?.vendor_names) {
      const vendorNames = rfq.vendor_names.split(',').map((v: string) => v.trim()).filter(Boolean)
      const { data: fallbackBids } = await supabaseAdmin
        .from('bids')
        .select('*')
        .in('vendor_name', vendorNames)
        .order('created_at', { ascending: false })
        .limit(10)

      const enriched = await enrichWithAirtableBidIds(
        (fallbackBids ?? []) as Record<string, unknown>[],
        rfqId,
      )
      return NextResponse.json({ bids: enriched })
    }

    return NextResponse.json({ bids: [] })
  } catch (err) {
    console.error('[/api/rfq-bids] Error:', err)
    return NextResponse.json({ bids: [] }, { status: 500 })
  }
}
