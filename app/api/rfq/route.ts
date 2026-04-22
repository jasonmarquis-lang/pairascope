import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { sendRFQToVendor, sendAdminErrorEmail } from '@/lib/email'
import { logError } from '@/lib/airtable'
import { supabaseAdmin } from '@/lib/supabase'
import * as postmark from 'postmark'

const base      = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)
const pmClient  = new postmark.ServerClient(process.env.POSTMARK_API_KEY!)
const FROM      = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'

export async function POST(req: NextRequest) {
  try {
    const { conversationId, projectName, scopeDocument, vendorIds } = await req.json()

    if (!conversationId || !scopeDocument) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const projectId = `PS-${Date.now().toString(36).toUpperCase()}`
    const today     = new Date().toISOString().split('T')[0]

    // Create RFQ record in Airtable
    const rfqRecord = await base('RFQs').create({
      'RFQ Title':      `${projectName || 'Project'} – RFQ – ${today}`,
      'Scope Document': scopeDocument,
      'Date Issued':    today,
      'Status':         'Sent',
    })
    const rfqId = rfqRecord.getId()

    // Fetch selected vendors
    let vendors: { id: string; name: string; email: string }[] = []
    if (vendorIds && vendorIds.length > 0) {
      const records = await Promise.all(vendorIds.map((id: string) => base('Vendors').find(id)))
      vendors = records.map((r) => ({
        id:    r.getId(),
        name:  r.get('Vendor Name') as string,
        email: r.get('Email')       as string,
      })).filter((v) => v.email) // only vendors with email addresses
    } else {
      const records = await base('Vendors').select({ filterByFormula: '{Active} = TRUE()', maxRecords: 10 }).all()
      vendors = records.map((r) => ({
        id:    r.getId(),
        name:  r.get('Vendor Name') as string,
        email: r.get('Email')       as string,
      })).filter((v) => v.email)
    }

    // Send RFQ to each vendor
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

    if (failed > 0) {
      await logError('RFQ email partial failure', `Sent: ${sent}, Failed: ${failed}, RFQ: ${rfqId}`, 'High')
    }

    // Save RFQ to Supabase
    await supabaseAdmin.from('rfqs').upsert({
      id:                rfqId,
      conversation_id:   conversationId,
      project_name:      projectName || 'Art Project',
      project_id:        projectId,
      scope_document:    scopeDocument,
      status:            'Sent',
      vendors_contacted: sent,
      vendor_names:      vendors.map((v) => v.name).join(', '),
      created_at:        new Date().toISOString(),
    })

    // Send confirmation email to artist
    try {
      const { data: session } = await supabaseAdmin.auth.admin.getUserById(conversationId).catch(() => ({ data: null }))
      // Get artist email from conversation
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('user_id')
        .eq('id', conversationId)
        .single()

      if (conv?.user_id) {
        const { data: artistData } = await supabaseAdmin.auth.admin.getUserById(conv.user_id)
        const artistEmail = artistData?.user?.email

        if (artistEmail) {
          const vendorList = vendors.map((v) => `• ${v.name}`).join('\n')
          await pmClient.sendEmail({
            From:    FROM,
            To:      artistEmail,
            Subject: `[Pairascope] Your RFQ has been sent – ${projectName || 'Art Project'}`,
            TextBody: `Hi,

Your RFQ for "${projectName || 'Art Project'}" has been sent to ${sent} vendor${sent !== 1 ? 's' : ''}:

${vendorList}

Reference: ${projectId}

Vendors will review your scope and respond directly through Pairascope. You'll receive an email notification when proposals arrive.

View your RFQ dashboard:
${process.env.NEXT_PUBLIC_APP_URL}/rfq-hub

Best,
Pairascope
create@pairascope.com`,
          })
        }
      }
    } catch (emailErr) {
      // Don't fail the whole request if confirmation email fails
      console.error('[RFQ] Artist confirmation email failed:', emailErr)
    }

    return NextResponse.json({ success: true, rfqId, projectId, vendorsSent: sent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logError('RFQ creation failed', msg, 'Critical')
    await sendAdminErrorEmail('RFQ creation failed', msg)
    return NextResponse.json({ error: 'Failed to create RFQ' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId   = searchParams.get('conversationId')

    // Get current user's session
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data } = await supabaseAdmin.auth.getUser(token)
      userId = data.user?.id ?? null
    }

    let query = supabaseAdmin.from('rfqs').select('*').order('created_at', { ascending: false })

    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
    } else if (userId) {
      // Get all conversations for this user
      const { data: convs } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
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
