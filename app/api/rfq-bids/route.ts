import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId = searchParams.get('rfqId')
    if (!rfqId) return NextResponse.json({ bids: [] })

    const { data: bids } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('rfq_id', rfqId)
      .order('created_at', { ascending: true })

    return NextResponse.json({ bids: bids ?? [] })
  } catch (err) {
    console.error('[/api/rfq-bids] Error:', err)
    return NextResponse.json({ bids: [] }, { status: 500 })
  }
}
