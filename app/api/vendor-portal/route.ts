import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

export async function POST(req: NextRequest) {
  try {
    const { email, vendorId } = await req.json()
    if (!email || !vendorId) return NextResponse.json({ error: 'Email and Vendor ID are required.' }, { status: 400 })

    // Look up vendor in Airtable by Vendor ID
    const records = await base('Vendors').select({
      filterByFormula: `AND({Vendor ID} = "${vendorId.trim()}", {Email} = "${email.trim().toLowerCase()}")`,
      maxRecords: 1,
      fields: ['Vendor Name', 'Email', 'Vendor ID'],
    }).all()

    if (records.length === 0) {
      return NextResponse.json({ error: 'No vendor found with that email and Vendor ID.' }, { status: 404 })
    }

    const record  = records[0]
    const airtableId = record.getId()
    const vendorName = record.get('Vendor Name') as string

    // Check if this vendor already has a Supabase account
    const { data: existingVendor } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('airtable_id', airtableId)
      .single()

    if (existingVendor?.user_id) {
      // Vendor already has an account - send magic link
      const { error: magicErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
        options: { redirectTo: 'https://www.pairascope.com/vendor?portal=true' }
      })
      if (magicErr) throw magicErr
      return NextResponse.json({ success: true, action: 'magic_link_sent', vendorName })
    }

    // New vendor - create Supabase account and send invite
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { redirectTo: 'https://www.pairascope.com/vendor?portal=true', data: { vendor_name: vendorName, is_vendor: true } }
    )
    if (createErr) throw createErr

    // Link to vendors table
    await supabaseAdmin.from('vendors').upsert({
      user_id:     newUser.user.id,
      airtable_id: airtableId,
      email:       email.trim().toLowerCase(),
      name:        vendorName,
      vendor_id:   vendorId.trim(),
    }, { onConflict: 'email' })

    return NextResponse.json({ success: true, action: 'invite_sent', vendorName })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/vendor-portal]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
