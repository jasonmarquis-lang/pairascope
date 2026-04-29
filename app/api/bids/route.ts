import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'
import * as postmark from 'postmark'

const base      = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)
const pmClient  = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')
const FROM      = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
const ADMIN     = process.env.ADMIN_EMAIL ?? 'admin@pairascope.com'

const B = {
  bidName:     'fldJX1eQxWeDiiBBi',
  bidStatus:   'fldoRrKQdMUUBsKfs',
  rfq:         'fldEcA2H38qycoSF7',
  vendor:      'fldYtyoBD6eTNjhWD',
  dateRcvd:    'flduY895gaf5M371G',
  priceLow:    'fldJoIj3fSqrPpv50',
  priceHigh:   'fldoDIEipxq8dSmXn',
  timeline:    'fldeLaKXoxDLEUHqZ',
  assumptions: 'fld9u1CNDDYla24mQ',
  notes:       'fldweU5X04jQvvQiP',
  bidType:     'fldBit1Yp7PPbkpJW',
  firmPrice:   'fldkpO6e8wvUy9gEg',
  depositAmt:  'fldaVTqkOpXBUijQG',
  depositPct:  'fldbXKSk7G9afhLW7',
}

async function getVendorByUser(userId: string, userEmail: string) {
  const { data: v1 } = await supabaseAdmin.from('vendors').select('*').eq('user_id', userId).single()
  if (v1) return v1
  const { data: v2 } = await supabaseAdmin.from('vendors').select('*').eq('email', userEmail).single()
  if (v2) {
    await supabaseAdmin.from('vendors').update({ user_id: userId }).eq('email', userEmail)
    return { ...v2, user_id: userId }
  }
  const { data: v3 } = await supabaseAdmin.from('vendors').insert({ user_id: userId, email: userEmail }).select().single()
  return v3
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId    = searchParams.get('rfqId')
    const vendorId = searchParams.get('vendorId')

    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    let userEmail: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const { data } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      userId    = data.user?.id ?? null
      userEmail = data.user?.email ?? null
    }

    if (rfqId) {
      const { data: rfq } = await supabaseAdmin.from('rfqs').select('*').eq('id', rfqId).single()
      let bid = null
      if (userId) {
        const { data: bidData } = await supabaseAdmin.from('bids').select('*').eq('rfq_id', rfqId).eq('vendor_id', userId).single()
        bid = bidData
      }
      return NextResponse.json({ rfq, bid })
    }

    if (vendorId && userId && userEmail) {
      const vendor = await getVendorByUser(userId, userEmail)
      const airtableId = vendor?.airtable_id

      let rfqList: Record<string, unknown>[] = []
      const { data: r1 } = await supabaseAdmin.from('rfqs').select('*').contains('vendor_ids', [userId]).order('created_at', { ascending: false })
      rfqList = r1 ?? []

      if (airtableId && rfqList.length === 0) {
        const { data: r2 } = await supabaseAdmin.from('rfqs').select('*').contains('vendor_ids', [airtableId]).order('created_at', { ascending: false })
        rfqList = r2 ?? []
      }

      if (rfqList.length === 0 && vendor?.name) {
        const { data: r3 } = await supabaseAdmin.from('rfqs').select('*').ilike('vendor_names', '%' + vendor.name + '%').order('created_at', { ascending: false })
        rfqList = r3 ?? []
      }

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

    const { rfqId, bidType, priceLow, priceHigh, firmPrice, depositAmount, depositPercentage, timeline, assumptions, notes } = await req.json()
    if (!rfqId || !timeline) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const vendor = await getVendorByUser(userId, userEmail)
    const vendorName = vendor?.name || userEmail

    const { data: rfq } = await supabaseAdmin.from('rfqs').select('*').eq('id', rfqId).single()

    const { data: bid, error: bidError } = await supabaseAdmin
      .from('bids')
      .upsert({
        rfq_id:             rfqId,
        vendor_id:          userId,
        vendor_name:        vendorName,
        quote_type:           bidType || 'ROM',
        price_low:          priceLow ?? null,
        price_high:         priceHigh ?? null,
        firm_price:         firmPrice ?? null,
        deposit_amount:     depositAmount ?? null,
        deposit_percentage: depositPercentage ?? null,
        timeline,
        assumptions: assumptions || null,
        notes:       notes || null,
        status:      'Submitted',
      }, { onConflict: 'rfq_id,vendor_id' })
      .select()
      .single()

    if (bidError) throw bidError

    try {
      const today = new Date().toISOString().split('T')[0]
      let airtableVendorId: string | null = vendor?.airtable_id ?? null
      if (!airtableVendorId) {
        const vendors = await base('Vendors').select({ filterByFormula: '{Email} = "' + userEmail + '"', maxRecords: 1 }).all()
        airtableVendorId = vendors[0]?.getId() ?? null
      }
      const bidFields: Airtable.FieldSet = {
        [B.bidName]:     vendorName + ' - ' + ((rfq as Record<string,unknown>)?.project_name ?? rfqId.slice(0, 8)),
        [B.bidStatus]:   'Under Review',
        [B.bidType]:     bidType || 'ROM',
        [B.dateRcvd]:    today,
        [B.timeline]:    timeline,
        [B.assumptions]: assumptions || '',
        [B.notes]:       notes || '',
      }
      if (priceLow)          bidFields[B.priceLow]    = Number(priceLow)
      if (priceHigh)         bidFields[B.priceHigh]   = Number(priceHigh)
      if (firmPrice)         bidFields[B.firmPrice]   = Number(firmPrice)
      if (depositAmount)     bidFields[B.depositAmt]  = Number(depositAmount)
      if (depositPercentage) bidFields[B.depositPct]  = Number(depositPercentage) / 100
      if (airtableVendorId) bidFields[B.vendor]    = [airtableVendorId]
      if (rfqId.startsWith('rec')) bidFields[B.rfq] = [rfqId]
      await base('Bids').create(bidFields)
    } catch (airtableErr) {
      console.error('[/api/bids] Airtable error:', JSON.stringify(airtableErr))
    }

    try {
      const currentStatuses = (rfq as Record<string, unknown>)?.vendor_statuses as Record<string, string> ?? {}
      await supabaseAdmin.from('rfqs').update({ vendor_statuses: { ...currentStatuses, [vendorName]: 'Responded' } }).eq('id', rfqId)
    } catch (statusErr) {
      console.error('[/api/bids] Status update error:', statusErr)
    }

    try {
      if ((rfq as Record<string, unknown>)?.conversation_id) {
        const convId = (rfq as Record<string, unknown>).conversation_id as string
        const projects = await base('Projects').select({ filterByFormula: '{Supabase Conversation ID} = "' + convId + '"', maxRecords: 1 }).all()
        if (projects[0]) {
          await base('Projects').update(projects[0].getId(), { 'fldLdWTW2uHq4fP0m': 'Proposal In' } as Airtable.FieldSet)
        }
      }
    } catch (projErr) {
      console.error('[/api/bids] Project status update failed:', projErr)
    }

    try {
      const priceText = (priceLow && priceHigh)
        ? '$' + Number(priceLow).toLocaleString() + ' - $' + Number(priceHigh).toLocaleString()
        : 'Not specified'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'
      await pmClient.sendEmail({
        From:     FROM,
        To:       ADMIN,
        Subject:  '[Pairascope] New estimate received - ' + ((rfq as Record<string, unknown>)?.project_name || 'Your project'),
        TextBody: 'Hi,\n\n' + vendorName + ' has submitted an estimate for "' + ((rfq as Record<string, unknown>)?.project_name || 'Art Project') + '".\n\nVendor: ' + vendorName + '\nPrice Range: ' + priceText + '\nTimeline: ' + timeline + (assumptions ? '\n\nAssumptions:\n' + assumptions : '') + (notes ? '\n\nNotes:\n' + notes : '') + '\n\nView your dashboard:\n' + appUrl + '/rfq-hub\n\nBest,\nPairascope',
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
