export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import * as postmark from 'postmark'
import { supabaseAdmin } from '@/lib/supabase'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

function getMailer() {
  const pmClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')
  const FROM = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
  return { pmClient, FROM }
}

async function sendVendorEmail(email: string, vendorName: string, magicUrl: string, isNew: boolean) {
  const { pmClient, FROM } = getMailer()
  const subject = isNew ? 'Welcome to Pairascope — access your vendor portal' : 'Your Pairascope Vendor Portal login link'
  const greeting = isNew ? 'You have been invited to the Pairascope vendor portal.' : 'Click the link below to access your Pairascope vendor portal.'
  const body = 'Hi ' + vendorName + ',' + '\n\n' + greeting + '\n\n' + magicUrl + '\n\n' + '(This link expires in 24 hours.)' + '\n\nBest,\nPairascope'
  await pmClient.sendEmail({ From: FROM, To: email, Subject: subject, TextBody: body })
}

export async function POST(req: NextRequest) {
  try {
    const { email, vendorId } = await req.json()
    if (!email || !vendorId) return NextResponse.json({ error: 'Email and Vendor ID are required.' }, { status: 400 })

    const records = await getBase()('Vendors').select({
      filterByFormula: 'AND({Vendor ID} = "' + vendorId.trim() + '", {Email} = "' + email.trim().toLowerCase() + '")',
      maxRecords: 1,
      fields: ['Vendor Name', 'Email', 'Vendor ID'],
    }).all()

    if (records.length === 0) {
      return NextResponse.json({ error: 'No vendor found with that email and Vendor ID.' }, { status: 404 })
    }

    const record = records[0]
    const airtableId = record.getId()
    const vendorName = record.get('Vendor Name') as string

    const { data: existingVendor } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('airtable_id', airtableId)
      .single()

    if (existingVendor?.user_id) {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
        options: { redirectTo: 'https://www.pairascope.com/vendor?portal=true' }
      })
      const magicUrl = linkData?.properties?.action_link || 'https://www.pairascope.com/vendor-portal'
      await sendVendorEmail(email.trim().toLowerCase(), vendorName, magicUrl, false)
      return NextResponse.json({ success: true, action: 'magic_link_sent', vendorName })
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())

    if (existingAuthUser) {
      await supabaseAdmin.from('vendors').upsert({
        user_id: existingAuthUser.id, airtable_id: airtableId,
        email: email.trim().toLowerCase(), name: vendorName, vendor_id: vendorId.trim(),
      }, { onConflict: 'email' })
      await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        user_metadata: { ...existingAuthUser.user_metadata, is_vendor: true, vendor_name: vendorName }
      })
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
        options: { redirectTo: 'https://www.pairascope.com/vendor?portal=true' }
      })
      const magicUrl = linkData?.properties?.action_link || 'https://www.pairascope.com/vendor-portal'
      await sendVendorEmail(email.trim().toLowerCase(), vendorName, magicUrl, false)
      return NextResponse.json({ success: true, action: 'magic_link_sent', vendorName })
    }

    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { redirectTo: 'https://www.pairascope.com/vendor?portal=true', data: { vendor_name: vendorName, is_vendor: true } }
    )
    if (createErr) throw createErr

    await supabaseAdmin.from('vendors').upsert({
      user_id: newUser.user.id, airtable_id: airtableId,
      email: email.trim().toLowerCase(), name: vendorName, vendor_id: vendorId.trim(),
    }, { onConflict: 'email' })

    const { data: linkData2 } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.trim().toLowerCase(),
      options: { redirectTo: 'https://www.pairascope.com/vendor?portal=true' }
    })
    const magicUrl2 = linkData2?.properties?.action_link || 'https://www.pairascope.com/vendor-portal'
    await sendVendorEmail(email.trim().toLowerCase(), vendorName, magicUrl2, true)

    return NextResponse.json({ success: true, action: 'invite_sent', vendorName })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/vendor-portal]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
