import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import * as postmark from 'postmark'
import { supabaseAdmin } from '@/lib/supabase'

async function getMailer() {
  const pmClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')
  const FROM = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
  return { pmClient, FROM }
}

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
      const { error: otpErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
        options: { redirectTo: 'https://www.pairascope.com/vendor?portal=true' }
      })
      if (otpErr) throw otpErr
      // Send email via Postmark
      const { pmClient, FROM } = await getMailer()
      await pmClient.sendEmail({
        From:     FROM,
        To:       email.trim().toLowerCase(),
        Subject:  'Your Pairascope Vendor Portal login link',
        TextBody: 'Hi ' + vendorName + ',

Click the link below to access your Pairascope vendor portal:

https://www.pairascope.com/vendor?portal=true

(This link expires in 24 hours.)

Best,
Pairascope',
      })
      return NextResponse.json({ success: true, action: 'magic_link_sent', vendorName })
    }

    // Check if email already exists in Supabase auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())

    if (existingAuthUser) {
      // Email exists in auth but not linked to vendor - link it and send login link
      await supabaseAdmin.from('vendors').upsert({
        user_id:     existingAuthUser.id,
        airtable_id: airtableId,
        email:       email.trim().toLowerCase(),
        name:        vendorName,
        vendor_id:   vendorId.trim(),
      }, { onConflict: 'email' })
      await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        user_metadata: { ...existingAuthUser.user_metadata, is_vendor: true, vendor_name: vendorName }
      })
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
        options: { redirectTo: 'https://www.pairascope.com/vendor?portal=true' }
      })
      if (linkErr) throw linkErr
      const magicUrl = linkData?.properties?.action_link || 'https://www.pairascope.com/vendor-portal'
      const { pmClient, FROM } = await getMailer()
      await pmClient.sendEmail({
        From:     FROM,
        To:       email.trim().toLowerCase(),
        Subject:  'Your Pairascope Vendor Portal login link',
        TextBody: 'Hi ' + vendorName + ',

Click the link below to access your Pairascope vendor portal:

' + magicUrl + '

(This link expires in 24 hours.)

Best,
Pairascope',
      })
      return NextResponse.json({ success: true, action: 'magic_link_sent', vendorName })
    }

    // Brand new user - invite via email
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

    // Send welcome email via Postmark
    const { data: linkData2 } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.trim().toLowerCase(),
      options: { redirectTo: 'https://www.pairascope.com/vendor?portal=true' }
    })
    const magicUrl2 = linkData2?.properties?.action_link || 'https://www.pairascope.com/vendor-portal'
    const { pmClient: pm2, FROM: from2 } = await getMailer()
    await pm2.sendEmail({
      From:     from2,
      To:       email.trim().toLowerCase(),
      Subject:  'Welcome to Pairascope — access your vendor portal',
      TextBody: 'Hi ' + vendorName + ',

You have been invited to the Pairascope vendor portal. Click the link below to set up your account and access your dashboard:

' + magicUrl2 + '

(This link expires in 24 hours.)

Best,
Pairascope',
    })

    return NextResponse.json({ success: true, action: 'invite_sent', vendorName })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/vendor-portal]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
