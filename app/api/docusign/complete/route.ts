export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import * as postmark from 'postmark'
import { getTemplate } from '@/lib/airtable'
import { supabaseAdmin } from '@/lib/supabase'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

async function getDocuSignToken(): Promise<string> {
  const privateKey = (process.env.DOCUSIGN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
  const clientId   = process.env.DOCUSIGN_CLIENT_ID!
  const userId     = process.env.DOCUSIGN_USER_ID!
  const header     = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const now        = Math.floor(Date.now() / 1000)
  const payload    = Buffer.from(JSON.stringify({
    iss: clientId, sub: userId,
    aud: 'account-d.docusign.com',
    iat: now, exp: now + 3600,
    scope: 'signature impersonation',
  })).toString('base64url')
  const { createSign } = await import('crypto')
  const signer    = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey, 'base64url')
  const jwt       = `${header}.${payload}.${signature}`
  const res       = await fetch('https://account-d.docusign.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('DocuSign token failed')
  return data.access_token
}

function postMessageResponse(type: string, bidId: string, appUrl: string): NextResponse {
  const fallback = type === 'docusign-complete'
    ? `${appUrl}/rfq-hub?signing=complete&bidId=${encodeURIComponent(bidId)}`
    : `${appUrl}/rfq-hub?signing=cancelled`
  const msg = JSON.stringify({ type, bidId })
  const fb  = JSON.stringify(fallback)
  const html = `<!DOCTYPE html><html><body><script>(function(){var m=${msg},f=${fb};try{if(window!==window.parent){window.parent.postMessage(m,'*');}else{window.location.replace(f);}}catch(e){window.location.replace(f);}})();</script></body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const envelopeId = searchParams.get('envelopeId')
  const bidId      = searchParams.get('bidId') ?? ''
  const event      = searchParams.get('event')
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'

  if (!envelopeId || !bidId) {
    return NextResponse.redirect(appUrl + '/rfq-hub')
  }

  if (event === 'decline' || event === 'cancel') {
    return postMessageResponse('docusign-cancelled', bidId, appUrl)
  }

  try {
    const token   = await getDocuSignToken()
    const baseUrl = `https://demo.docusign.net/restapi/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID!}`
    const base    = getBase()

    // Fetch signed PDF from DocuSign
    const docRes = await fetch(`${baseUrl}/envelopes/${envelopeId}/documents/1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    let signedPdfBase64: string | null = null
    if (docRes.ok) {
      const buf = await docRes.arrayBuffer()
      signedPdfBase64 = Buffer.from(buf).toString('base64')
    }

    // Fetch bid record once; reuse for all downstream logic
    const bidRecord   = await base('Bids').find(bidId)
    const vendorName  = bidRecord.get('Vendor Name') as string ?? 'Vendor'
    const vendorEmail = bidRecord.get('Vendor Email') as string ?? null
    const dealIds     = bidRecord.get('Deal') as string[] | undefined
    const rfqIds      = bidRecord.get('RFQ') as string[] | undefined

    // Update Airtable Bid status
    await base('Bids').update(bidId, { 'Status': 'Awarded' } as Airtable.FieldSet)

    // Save signed agreement to Deals table
    if (signedPdfBase64 && dealIds?.length) {
      try {
        await base('Deals').update(dealIds[0], {
          'Signed Agreement': [{
            url:      `data:application/pdf;base64,${signedPdfBase64}`,
            filename: 'signed-agreement.pdf',
          }],
        } as any)
      } catch (dealErr) {
        console.error('[docusign/complete] Deal update failed:', dealErr)
      }
    }

    // Resolve Supabase conversation ID from Airtable RFQ link (used for both Supabase update + artist email)
    let convId: string | null = null
    if (rfqIds?.length) {
      try {
        const rfqRec = await base('RFQs').find(rfqIds[0])
        convId = rfqRec.get('Supabase Conversation ID') as string ?? null
      } catch (rfqErr) {
        console.error('[docusign/complete] RFQ fetch failed:', rfqErr)
      }
    }

    // Update Supabase vendor_statuses → 'Awarded' and RFQ status → 'Closed'
    if (convId) {
      try {
        const { data: rfqData } = await supabaseAdmin
          .from('rfqs')
          .select('id, vendor_statuses')
          .eq('conversation_id', convId)
          .single()
        if (rfqData) {
          const currentStatuses = (rfqData.vendor_statuses as Record<string, string>) ?? {}
          await supabaseAdmin
            .from('rfqs')
            .update({
              vendor_statuses: { ...currentStatuses, [vendorName]: 'Awarded' },
              status: 'Closed',
            })
            .eq('id', rfqData.id)
        }
      } catch (sbErr) {
        console.error('[docusign/complete] Supabase update failed:', sbErr)
      }
    }

    // Send signed agreement email to artist and vendor
    try {
      let artistEmail: string | null = null
      if (convId) {
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('user_id')
          .eq('id', convId)
          .single()
        if (conv?.user_id) {
          const { data: ud } = await supabaseAdmin.auth.admin.getUserById(conv.user_id)
          artistEmail = ud?.user?.email ?? null
        }
      }

      const pmClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')
      const FROM     = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
      const templateContent = await getTemplate('Agreement Signed')
      const emailBody = templateContent
        ? templateContent
            .replace('{{vendor_name}}', vendorName)
            .replace('{{app_url}}', appUrl)
        : [
            'Your project agreement has been signed.',
            '',
            `Vendor: ${vendorName}`,
            '',
            'The signed agreement is now on file. You can proceed with the deposit to commence the project.',
            '',
            `View your dashboard: ${appUrl}/rfq-hub`,
            '',
            'Pairascope',
          ].join('\n')

      const subject    = `Agreement Signed — ${vendorName}`
      const recipients = [artistEmail, vendorEmail].filter(Boolean) as string[]
      await Promise.all(recipients.map((to) =>
        pmClient.sendEmail({ From: FROM, To: to, Subject: subject, TextBody: emailBody })
      ))
    } catch (emailErr) {
      console.error('[docusign/complete] Email failed:', emailErr)
    }

    return postMessageResponse('docusign-complete', bidId, appUrl)
  } catch (err) {
    console.error('[docusign/complete]', err)
    return NextResponse.redirect(`${appUrl}/rfq-hub?signing=error`)
  }
}
