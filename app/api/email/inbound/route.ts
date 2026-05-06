export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as postmark from 'postmark'

const getPmClient = () => new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')
const FROM = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const fromEmail      = body.From ?? ''
    const fromName       = body.FromName ?? ''
    const toEmail        = body.To ?? ''
    const subject        = body.Subject ?? ''
    const textBody       = body.TextBody ?? ''
    const strippedReply  = body.StrippedTextReply ?? textBody
    const attachments    = body.Attachments ?? []
    const hasAttachment  = attachments.length > 0
    const mailboxHash    = body.MailboxHash ?? ''

    // Extract rfq_id from the To address or MailboxHash
    // RFQ emails are sent with reply-to: ${projectId}@pairascope.com
    // Postmark inbound address is used — we parse the mailbox hash or To field
    let rfqId: string | null = null

    // Try MailboxHash first (set when using + addressing)
    if (mailboxHash) {
      rfqId = mailboxHash
    } else {
      // Try to extract from To address prefix before @
      const toMatch = toEmail.match(/^([^@+]+)/)
      if (toMatch) rfqId = toMatch[1]
    }

    // Find RFQ in Supabase by project_id or id
    let resolvedRfqId: string | null = null
    if (rfqId) {
      const { data: rfq } = await supabaseAdmin
        .from('rfqs')
        .select('id')
        .or(`project_id.eq.${rfqId},id.eq.${rfqId}`)
        .single()
      resolvedRfqId = rfq?.id ?? null
    }

    // Determine sender type
    let senderType: 'artist' | 'vendor' | 'system' = 'vendor'
    if (resolvedRfqId) {
      const { data: rfq } = await supabaseAdmin
        .from('rfqs')
        .select('conversation_id')
        .eq('id', resolvedRfqId)
        .single()
      if (rfq?.conversation_id) {
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('user_id')
          .eq('id', rfq.conversation_id)
          .single()
        if (conv?.user_id) {
          const { data: ud } = await supabaseAdmin.auth.admin.getUserById(conv.user_id)
          if (ud?.user?.email?.toLowerCase() === fromEmail.toLowerCase()) {
            senderType = 'artist'
          }
        }
      }
    }

    // Log message to Supabase
    await supabaseAdmin.from('email_messages').insert({
      rfq_id:         resolvedRfqId,
      from_email:     fromEmail,
      from_name:      fromName,
      subject,
      body:           textBody,
      stripped_reply: strippedReply,
      has_attachment: hasAttachment,
      direction:      'inbound',
      sender_type:    senderType,
    })

    // Handle attachments — strip and auto-respond
    if (hasAttachment) {
      await supabaseAdmin.from('email_messages').insert({
        rfq_id:      resolvedRfqId,
        from_email:  FROM,
        from_name:   'Pairascope',
        subject:     'Please upload files via the dashboard',
        body:        'We noticed you attached files to your email. For security and organization, files must be uploaded via the Pairascope dashboard.\n\nPlease use the link below to upload your files:\n' + (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com') + '/vendor\n\nIf you have questions, just reply to this email.',
        direction:   'outbound',
        sender_type: 'system',
      })

      await getPmClient().sendEmail({
        From:     FROM,
        To:       fromEmail,
        Subject:  'Please upload files via the dashboard',
        TextBody: 'Hi ' + (fromName || 'there') + ',\n\nWe noticed you attached files to your email. For security and organization, files must be uploaded via the Pairascope dashboard.\n\nUpload your files here:\n' + (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com') + '/vendor\n\nFor quick questions, just reply to this email.\n\nPairascope',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[email/inbound]', err)
    return NextResponse.json({ ok: true }) // Always return 200 to Postmark
  }
}
