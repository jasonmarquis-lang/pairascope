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

    if (bids && bids.length > 0) {
      return NextResponse.json({ bids })
    }

    // Log what we have for this rfqId to debug
    console.log('[rfq-bids] No bids found for rfqId:', rfqId)

    // Try fetching all bids to see what rfq_ids exist
    const { data: allBids } = await supabaseAdmin
      .from('bids')
      .select('id, rfq_id, vendor_name, status')
      .limit(20)

    console.log('[rfq-bids] All bids in table:', JSON.stringify(allBids))

    return NextResponse.json({ bids: [] })
  } catch (err) {
    console.error('[/api/rfq-bids] Error:', err)
    return NextResponse.json({ bids: [] }, { status: 500 })
  }
}
