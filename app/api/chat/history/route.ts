import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId   = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ messages: [], snapshot: null }, { status: 400 })
    }

    // Fetch messages for this conversation
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    // Fetch latest snapshot for this conversation
    const { data: snapshots } = await supabaseAdmin
      .from('project_snapshots')
      .select('snapshot_data')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)

    const snapshot = snapshots?.[0]?.snapshot_data ?? null

    const formatted = (messages ?? []).map((m) => ({
      id:      m.id,
      role:    m.role,
      content: m.content,
    }))

    return NextResponse.json({ messages: formatted, snapshot })
  } catch (err) {
    console.error('[/api/chat/history] Error:', err)
    return NextResponse.json({ messages: [], snapshot: null }, { status: 500 })
  }
}
