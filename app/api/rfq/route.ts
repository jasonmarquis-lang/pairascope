import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { sendRFQToVendor, sendAdminErrorEmail } from '@/lib/email'
import { logError, getAccountIdByEmail } from '@/lib/airtable'
import { supabaseAdmin } from '@/lib/supabase'
import * as postmark from 'postmark'

const base     = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)
const pmClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? 'POSTMARK_API_TEST')
const FROM     = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
const ADMIN    = process.env.ADMIN_EMAIL ?? 'admin@pairascope.com'

export async function POST(req: NextRequest) {
  try {
    const { conversationId, projectName, scopeDocument, vendorIds, vendorNames } = await req.json()
    if (!conversationId || !scopeDocument) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const projectId = `PS-${Date.now().toString(36).toUpperCase()}`
    const today     = new Date().toISOString().split('T')[0]

    // Find or create Airtable project record
    let airtableProjectId: string | null = null
    try {
      const existing = await base('Projects')
        .select({ filterByFormula: `{Supabase Conversation ID} = "${conversationId}"`, maxRecords: 1 })
        .all()
      airtableProjectId = existing[0]?.getId() ?? null

      if (!airtableProjectId) {
        const proj = await base('Projects').create({
          'fldN7F3Y8YtbWtSzd': projectName || 'Art Project',
          'fldngbTEeVeb7SFBR': conversationId,
          'fldW3VUda1MLRODw7': today,
          'fldLdWTW2uHq4fP0m': 'RFQ Sent',
        } as Airtable.FieldSet)
        airtableProjectId = proj.getId()
      } else {
        await base('Projects').update(airtableProjectId, {
          'fldLdWTW2uHq4fP0m': 'RFQ Sent',
        } as Airtable.FieldSet)
      }
    } catch (projErr) {
      console.error('[RFQ] Project record error:', JSON.stringify(projErr))
    }

    // Create RFQ record
    let rfqId = `rfq_${Date.now()}`
    try {
      const rfqRecord = await base('RFQs').create({
        'RFQ Title':      `${projectName || 'Project'} \u2013 RFQ \u2013 ${today}`,
        'Scope Document': scopeDocument,
        'Date Issued':    today,
        'Status':         'Sent',
      } as Airtable.FieldSet)
      rfqId = rfqRecord.getId()
    } catch (rfqErr) {
      console.error('[RFQ] RFQ record error:', JSON.stringify(rfqErr))
    }

    // Fetch vendors
    let vendors: { id: string; name: string; email: string }[] = []
    if (vendorIds?.length > 0) {
      try {
        const records = await Promise.all(vendorIds.map((id: string) => base('Vendors').find(id)))
        vendors = records
          .map((r) => ({ id: r.getId(), name: r.get('Vendor Name') as string, email: r.get('Email') as string }))
          .filter((v) => v.email)
      } catch (vendorErr) {
        console.error('[RFQ] Vendor fetch error:', JSON.stringify(vendorErr))
      }
    }

    // Send emails
    const emailResults = await Promise.allSettled(
      vendors.map((vendor) =>
        sendRFQToVendor({
          vendorEmail:   vendor.email,
          vendorName:    vendor.name,
          projectName:   projectName || 'Art Project',
          projectId,
          scopeDocument,
          replyToRelay:  `${projectId.toLowerCase()}@pairascope.com`,
        })
      )
    )
    const sent   = emailResults.filter((r) => r.status === 'fulfilled').length
    const failed = emailResults.filter((r) => r.status === 'rejected').length
    if (failed > 0) await logError('RFQ email partial failure', `Sent: ${sent}, Failed: ${failed}`, 'High').catch(() => {})

    // Save to Supabase
    try {
      await supabaseAdmin.from('rfqs').upsert({
        id:                rfqId,
        conversation_id:   conversationId,
        project_name:      projectName || 'Art Project',
        project_id:        projectId,
        scope_document:    scopeDocument,
        status:            'Sent',
        vendors_contacted: sent,
        vendor_names:      (vendorNames || vendors.map((v) => v.name)).join(', '),
        vendor_ids:        vendorIds ?? [],
        created_at:        new Date().toISOString(),
      })
    } catch (sbErr) {
      console.error('[RFQ] Supabase error:', JSON.stringify(sbErr))
    }

    // Link Account record and Vendors Contacted to Project
    try {
      // Get artist email from auth header first, fall back to conversation user_id
      let artistEmail: string | null = null
      const rfqAuth = req.headers.get('authorization')
      if (rfqAuth?.startsWith('Bearer ')) {
        const { data: rfqUser } = await supabaseAdmin.auth.getUser(rfqAuth.slice(7))
        artistEmail = rfqUser.user?.email ?? null
      }
      if (!artistEmail) {
        const { data: conv } = await supabaseAdmin.from('conversations').select('user_id').eq('id', conversationId).single()
        if (conv?.user_id) {
          const { data: ud } = await supabaseAdmin.auth.admin.getUserById(conv.user_id)
          artistEmail = ud?.user?.email ?? null
        }
      }
      if (artistEmail && airtableProjectId) {
        const { getAccountIdByEmail } = await import('@/lib/airtable')
        const accountId = await getAccountIdByEmail(artistEmail)
        if (accountId) {
          await base('Projects').update(airtableProjectId, { 'fldiIKuIYg3ZUFb4j': [accountId] } as Airtable.FieldSet)
          await base('RFQs').update(rfqId, { 'fldHzowEvX6pIC0rR': [accountId] } as Airtable.FieldSet)
        }
      }
      // Link Vendors Contacted regardless of account
      if (airtableProjectId && vendorIds?.length > 0) {
        await base('Projects').update(airtableProjectId, { 'fldIHf9NMXMX6p0MQ': vendorIds } as Airtable.FieldSet)
      }
    } catch (linkErr) {
      console.error('[RFQ] Account/vendor linking failed:', linkErr)
    }

    // Artist confirmation email
    try {
      const { data: conv } = await supabaseAdmin
        .from('conversations').select('user_id').eq('id', conversationId).single()
      if (conv?.user_id) {
        const { data: artistData } = await supabaseAdmin.auth.admin.getUserById(conv.user_id)
        const rawEmail = artistData?.user?.email
        const artistEmail = (rawEmail && rawEmail !== process.env.POSTMARK_FROM_EMAIL) ? rawEmail : process.env.ADMIN_EMAIL
        if (artistEmail) {
          const vendorList = (vendorNames || vendors.map((v) => v.name))
            .map((n: string) => `\u2022 ${n}`).join('\n')
          await pmClient.sendEmail({
            From:     FROM,
            To:       ADMIN,
            Subject:  `[Pairascope] Your RFQ has been sent \u2013 ${projectName || 'Art Project'}`,
            TextBody: `Hi,\n\nYour RFQ for "${projectName || 'Art Project'}" has been sent to ${sent} vendor${sent !== 1 ? 's' : ''}:\n\n${vendorList}\n\nReference: ${projectId}\n\nView your dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}/rfq-hub\n\nBest,\nPairascope`,
          })
        }
      }
    } catch (emailErr) {
      console.error('[RFQ] Confirmation email failed:', emailErr)
    }

    return NextResponse.json({ success: true, rfqId, projectId, vendorsSent: sent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[RFQ] Fatal error:', msg)
    await logError('RFQ creation failed', msg, 'Critical').catch(() => {})
    await sendAdminErrorEmail('RFQ creation failed', msg).catch(() => {})
    return NextResponse.json({ error: 'Failed to create RFQ' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      userId = data.user?.id ?? null
    }
    let query = supabaseAdmin.from('rfqs').select('*').order('created_at', { ascending: false })
    if (userId) {
      const { data: convs } = await supabaseAdmin
        .from('conversations').select('id').eq('user_id', userId)
      const convIds = (convs ?? []).map((c) => c.id)
      if (convIds.length > 0) {
        query = query.in('conversation_id', convIds)
      } else {
        return NextResponse.json({ rfqs: [] })
      }
    }
    const { data } = await query
    return NextResponse.json({ rfqs: data ?? [] })
  } catch (err) {
    console.error('[/api/rfq] GET failed:', err)
    return NextResponse.json({ rfqs: [] })
  }
}
