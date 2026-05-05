export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const envelopeId = searchParams.get('envelopeId')
    const bidId      = searchParams.get('bidId')
    const event      = searchParams.get('event')

    if (!envelopeId || !bidId) {
      return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL + '/rfq-hub')
    }

    // If user declined or cancelled, just redirect back
    if (event === 'decline' || event === 'cancel') {
      return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL + '/rfq-hub?signing=cancelled')
    }

    const token     = await getDocuSignToken()
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID!
    const baseUrl   = `https://demo.docusign.net/restapi/v2.1/accounts/${accountId}`

    // Fetch signed document from DocuSign
    const docRes = await fetch(`${baseUrl}/envelopes/${envelopeId}/documents/1`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    let signedPdfBase64: string | null = null
    if (docRes.ok) {
      const buf = await docRes.arrayBuffer()
      signedPdfBase64 = Buffer.from(buf).toString('base64')
    }

    // Update Bid status to Awarded in Airtable
    const base = getBase()
    await base('Bids').update(bidId, { 'Status': 'Awarded' } as Airtable.FieldSet)

    // Save signed agreement to Deals table if we have the PDF
    if (signedPdfBase64) {
      try {
        const bids = await base('Bids').find(bidId)
        const dealIds = bids.get('Deal') as string[] | undefined
        if (dealIds?.length) {
          await base('Deals').update(dealIds[0], {
            'Signed Agreement': [{
              url:      `data:application/pdf;base64,${signedPdfBase64}`,
              filename: 'signed-agreement.pdf',
            }],
          } as any)
        }
      } catch (dealErr) {
        console.error('[docusign/complete] Deal update failed:', dealErr)
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'
    return NextResponse.redirect(`${appUrl}/rfq-hub?signing=complete&bidId=${bidId}`)
  } catch (err) {
    console.error('[docusign/complete]', err)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'
    return NextResponse.redirect(`${appUrl}/rfq-hub?signing=error`)
  }
}
