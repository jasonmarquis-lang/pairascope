import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'
import * as postmark from 'postmark'

const base      = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)
const pmClient  = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? 'POSTMARK_API_TEST')
const FROM      = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
const ADMIN     = process.env.ADMIN_EMAIL ?? 'jasonmarquis@gmail.com'

async function getVendorByUser(userId: string, userEmail: string) {
  // First check Supabase vendors table
  const { data: vendorRow } = await supabaseAdmin
    .from('vendors')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (vendorRow) return vendorRow

  // If not found by user_id, try email match and link the account
  const { data: vendorByEmail } = await supabaseAdmin
    .from('vendors')
    .select('*')
    .eq('email', userEmail)
    .single()

  if (vendorByEmail) {
    // Link this Supabase user to the vendor record
    await supabaseAdmin
      .from('vendors')
      .update({ user_id: userId })
      .eq('email', userEmail)
    return { ...vendorByEmail, user_id: userId }
  }

  // Create a new vendor record for this user
  const { data: newVendor } = await supabaseAdmin
    .from('vendors')
    .insert({ user_id: userId, email: userEmail })
    .select()
    .single()

  return newVendor
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId    = searchParams.get('rfqId')
    const vendorId = searchParams.get('vendorId')

    // Get auth user
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    let userEmail: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      userId    = data.user?.id ?? null
      userEmail = data.user?.email ?? null
    }

    if (rfqId) {
      // Single RFQ detail + existing bid
      const { data: rfq } = await supabaseAdmin.from('rfqs').select('*').eq('id', rfqId).single()

      let bid = null
      if (userId) {
        const { data: bidData } = await supabaseAdmin
          .from('bids')
          .select('*')
          .eq('rfq_id', rfqId)
          .eq('vendor_id', userId)
          .single()
        bid = bidData
      }

      return NextResponse.json({ rfq, bid })
    }

    if (vendorId && userId && userEmail) {
      // Get vendor record to find their Airtable ID
      const vendor = await getVendorByUser(userId, userEmail)
      const airtableId = vendor?.airtable_id

      // Find RFQs that include this vendor — match by Supabase user_id OR Airtable ID
      let rfqList: Record<string, unknown>[] = []

      // Try matching by Supabase user_id in vendor_ids array
      const { data: rfqsByUserId } = await supabaseAdmin
        .from('rfqs')
        .select('*')
        .contains('vendor_ids', [userId])
        .order('created_at', { ascending: false })

      rfqList = rfqsByUserId ?? []

      // Also try matching by Airtable ID if available
      if (airtableId && rfqList.length === 0) {
        const { data: rfqsByAirtableId } = await supabaseAdmin
          .from('rfqs')
          .select('*')
          .contains('vendor_ids', [airtableId])
          .order('created_at', { ascending: false })
        rfqList = rfqsByAirtableId ?? []
      }

      // Also try matching by vendor name in vendor_names
      if (rfqList.length === 0 && vendor?.name) {
        const { data: rfqsByName } = await supabaseAdmin
          .from('rfqs')
          .select('*')
          .ilike('vendor_names', `%${vendor.name}%`)
          .order('created_at', { ascending: false })
        rfqList = rfqsByName ?? []
      }

      // Get submitted bids
      const { data: bids } = await supabaseAdmin.from('bids').select('rfq_id').eq('vendor_id', userId)
      const submittedIds = new Set((bids ?? []).map((b) => b.rfq_id))

      const rfqsWithStatus = rfqList.map((rfq) => ({ ...rfq, bid_submitted: submittedIds.has(rfq.id as string) }))
      return NextResponse.json({ rfqs: rfqsWithStatus })
    }

    return NextResponse.json({ rfqs: [] })
  } catch (err) {
    console.error('[/api/bids] GET error:', err)
    return NextResponse.json({ rfqs: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    const userId    = userData.user?.id
    const userEmail = userData.user?.email
    if (!userId || !userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rfqId, priceLow, priceHigh, timeline, assumptions, notes } = await req.json()
    if (!rfqId || !timeline) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    // Get or create vendor record
    const vendor = await getVendorByUser(userId, userEmail)
    const vendorName = vendor?.name || userEmail

    // Get RFQ
    const { data: rfq } = await supabaseAdmin.from('rfqs').select('*').eq('id', rfqId).single()

    // Save bid
    const { data: bid, error: bidError } = await supabaseAdmin
      .from('bids')
      .upsert({ rfq_id: rfqId, vendor_id: userId, vendor_name: vendorName, price_low: priceLow ?? null, price_high: priceHigh ?? null, timeline, assumptions: assumptions || null, notes: notes || null, status: 'Submitted' }, { onConflict: 'rfq_id,vendor_id' })
      .select()
      .single()

    if (bidError) throw bidError

    // Save to Airtable
    try {
      await base('Responses').create({
        'RFQ ID':      rfqId,
        'Vendor Name': vendorName,
        'Price Low':   priceLow ?? 0,
        'Price High':  priceHigh ?? 0,
        'Timeline':    timeline,
        'Assumptions': assumptions || '',
        'Notes':       notes || '',
        'Status':      'Submitted',
      } as Airtable.FieldSet)
    } catch (airtableErr) {
      console.error('[/api/bids] Airtable error:', airtableErr)
    }

    // Update vendor status in RFQ
    try {
      const currentStatuses = (rfq as Record<string, unknown>)?.vendor_statuses as Record<string, string> ?? {}
      await supabaseAdmin.from('rfqs').update({ vendor_statuses: { ...currentStatuses, [vendorName]: 'Responded' } }).eq('id', rfqId)
    } catch (statusErr) {
      console.error('[/api/bids] Status update error:', statusErr)
    }

    // Notify artist
    try {
      const priceText = (priceLow && priceHigh) ? `$${Number(priceLow).toLocaleString()} \u2013 $${Number(priceHigh).toLocaleString()}` : 'Not specified'
      await pmClient.sendEmail({
        From:    FROM,
        To:      ADMIN,
        Subject: `[Pairascope] New estimate received \u2013 ${(rfq as Record<string, unknown>)?.project_name || 'Your project'}`,
        TextBody: `Hi,\n\n${vendorName} has submitted an estimate for "${(rfq as Record<string, unknown>)?.project_name || 'Art Project'}".\n\nVendor: ${vendorName}\nPrice Range: ${priceText}\nTimeline: ${timeline}${assumptions ? '\n\nAssumptions:\n' + assumptions : ''}${notes ? '\n\nNotes:\n' + notes : ''}\n\nView your dashboard:\n${process.env.NEXT_PUBLIC_APP_URL}/rfq-hub\n\nBest,\nPairascope`,
      })
    } catch (emailErr) {
      console.error('[/api/bids] Notification email error:', emailErr)
    }

    return NextResponse.json({ success: true, bid })
  } catch (err) {
    console.error('[/api/bids] POST error:', err)
    return NextResponse.json({ error: 'Failed to submit bid' }, { status: 500 })
  }
}
