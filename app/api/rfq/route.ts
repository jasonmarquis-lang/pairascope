import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { sendRFQToVendor, sendAdminErrorEmail } from '@/lib/email'
import { logError } from '@/lib/airtable'
import { supabaseAdmin } from '@/lib/supabase'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

export async function POST(req: NextRequest) {
  try {
    const {
      conversationId,
      projectName,
      scopeDocument,
      vendorIds,
    } = await req.json()

    if (!conversationId || !scopeDocument) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate a unique project reference ID
    const projectId = `PS-${Date.now().toString(36).toUpperCase()}`
    const today     = new Date().toISOString().split('T')[0]

    // Create RFQ record in Airtable
    const rfqRecord = await base('RFQs').create({
      'RFQ Title':    `${projectName || 'Project'} – RFQ – ${today}`,
      'Scope Document': scopeDocument,
      'Date Issued':  today,
      'Status':       'Sent',
    })

    const rfqId = rfqRecord.getId()

    // Fetch vendors to contact — either specific ones or all active
    let vendors: { id: string; name: string; email: string }[] = []

    if (vendorIds && vendorIds.length > 0) {
      const records = await Promise.all(
        vendorIds.map((id: string) => base('Vendors').find(id))
      )
      vendors = records.map((r) => ({
        id:    r.getId(),
        name:  r.get('Vendor Name') as string,
        email: r.get('Email') as string,
      }))
    } else {
      const records = await base('Vendors')
        .select({ filterByFormula: '{Active} = TRUE()', maxRecords: 10 })
        .all()
      vendors = records.map((r) => ({
        id:    r.getId(),
        name:  r.get('Vendor Name') as string,
        email: r.get('Email') as string,
      }))
    }

    // Send RFQ email to each vendor via Postmark relay
    const emailResults = await Promise.allSettled(
      vendors.map((vendor) =>
        sendRFQToVendor({
          vendorEmail:   vendor.email,
          vendorName:    vendor.name,
          projectName:   projectName || 'Art Project',
          projectId,
          scopeDocument,
          replyToRelay:  `${projectId.toLowerCase()}@${process.env.POSTMARK_INBOUND_DOMAIN ?? 'pairascope.com'}`,
        })
      )
    )

    const sent    = emailResults.filter((r) => r.status === 'fulfilled').length
    const failed  = emailResults.filter((r) => r.status === 'rejected').length

    if (failed > 0) {
      await logError(
        'RFQ email send partial failure',
        `Sent: ${sent}, Failed: ${failed}, RFQ: ${rfqId}`,
        'High'
      )
    }

    // Save RFQ to Supabase for artist dashboard
    await supabaseAdmin.from('rfqs').upsert({
      id:               rfqId,
      conversation_id:  conversationId,
      project_name:     projectName || 'Art Project',
      project_id:       projectId,
      scope_document:   scopeDocument,
      status:           'Sent',
      vendors_contacted: vendors.length,
      created_at:       new Date().toISOString(),
    })

    return NextResponse.json({
      success:   true,
      rfqId,
      projectId,
      vendorsSent: sent,
    })
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

    if (!conversationId) {
      return NextResponse.json({ rfqs: [] })
    }

    const { data } = await supabaseAdmin
      .from('rfqs')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })

    return NextResponse.json({ rfqs: data ?? [] })
  } catch (err) {
    console.error('[/api/rfq] GET failed:', err)
    return NextResponse.json({ rfqs: [] })
  }
}
