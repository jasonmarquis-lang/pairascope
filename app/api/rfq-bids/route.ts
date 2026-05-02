export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

    if (bids && bids.length > 0) return NextResponse.json({ bids })

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

      return NextResponse.json({ bids: fallbackBids ?? [] })
    }

    return NextResponse.json({ bids: [] })
  } catch (err) {
    console.error('[/api/rfq-bids] Error:', err)
    return NextResponse.json({ bids: [] }, { status: 500 })
  }
}
