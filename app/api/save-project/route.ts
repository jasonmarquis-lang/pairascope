export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logError } from '@/lib/airtable'
import { sendAdminErrorEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const formData      = await req.formData()
    const file          = formData.get('file') as File | null
    const conversationId = formData.get('conversationId') as string

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'Missing file or conversationId' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const ext      = file.name.split('.').pop()
    const filename = `${conversationId}/${uuidv4()}.${ext}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    const { data, error } = await supabaseAdmin.storage
      .from('uploads')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert:      false,
      })

    if (error) throw error

    // Record in files table
    await supabaseAdmin.from('files').insert({
      id:              uuidv4(),
      conversation_id: conversationId,
      path:            data.path,
      mime_type:       file.type,
      size:            file.size,
      original_name:   file.name,
    })

    return NextResponse.json({ success: true, path: data.path })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logError('File upload failed', msg, 'High')
    await sendAdminErrorEmail('File upload failed', msg)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
