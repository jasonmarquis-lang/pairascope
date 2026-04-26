import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId = searchParams.get('rfqId')
    if (!rfqId) return NextResponse.json({ bids: [] })

    const { data: bids, error } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('rfq_id', rfqId)
      .order('created_at', { ascending: true })

    if (error) console.error('[rfq-bids] Query error:', error)
    console.log('[rfq-bids] rfqId:', rfqId, 'found:', bids?.length ?? 0, 'bids')

    return NextResponse.json({ bids: bids ?? [] })
  } catch (err) {
    console.error('[/api/rfq-bids] Error:', err)
    return NextResponse.json({ bids: [] }, { status: 500 })
  }
}
