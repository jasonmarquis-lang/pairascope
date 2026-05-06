export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId = searchParams.get('rfqId')
    if (!rfqId) return NextResponse.json({ messages: [] })

    const { data: messages } = await supabaseAdmin
      .from('email_messages')
      .select('id, from_email, from_name, body, stripped_reply, has_attachment, direction, sender_type, created_at')
      .eq('rfq_id', rfqId)
      .order('created_at', { ascending: true })
      .limit(50)

    return NextResponse.json({ messages: messages ?? [] })
  } catch (err) {
    console.error('[email/messages]', err)
    return NextResponse.json({ messages: [] })
  }
}
