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

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const now     = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iss: clientId,
    sub: userId,
    aud: 'account-d.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  })).toString('base64url')

  const { createSign } = await import('crypto')
  const signer    = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(privateKey, 'base64url')
  const jwt       = `${header}.${payload}.${signature}`

  const res  = await fetch('https://account-d.docusign.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('DocuSign token failed: ' + JSON.stringify(data))
  return data.access_token
}

async function fetchProposalPdf(bidId: string): Promise<{ base64: string; name: string } | null> {
  const base   = getBase()
  const record = await base('Bids').find(bidId)
  const attachments = record.get('Proposal File') as { url: string; filename: string }[] | undefined
  if (!attachments?.length) return null

  const att = attachments[0]
  const res = await fetch(att.url)
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  return { base64: Buffer.from(buf).toString('base64'), name: att.filename }
}

export async function POST(req: NextRequest) {
  try {
    const { bidId, signerName, signerEmail } = await req.json()
    if (!bidId || !signerName || !signerEmail) {
      return NextResponse.json({ error: 'Missing bidId, signerName, or signerEmail' }, { status: 400 })
    }

    const token      = await getDocuSignToken()
    const accountId  = process.env.DOCUSIGN_ACCOUNT_ID!
    const baseUrl    = `https://demo.docusign.net/restapi/v2.1/accounts/${accountId}`

    const pdf = await fetchProposalPdf(bidId)

    let document: Record<string, unknown>
    let tabs: Record<string, unknown>

    if (pdf) {
      document = {
        documentBase64: pdf.base64,
        name:           pdf.name,
        fileExtension:  'pdf',
        documentId:     '1',
      }
      tabs = {
        signHereTabs: [{
          anchorString:  '/sig1/',
          anchorXOffset: '0',
          anchorYOffset: '0',
          anchorUnits:   'pixels',
        }],
        dateSignedTabs: [{
          anchorString:  '/date1/',
          anchorXOffset: '0',
          anchorYOffset: '0',
          anchorUnits:   'pixels',
        }],
      }
    } else {
      // No PDF — create a simple signature page
      const signaturePage = `
        <html><body style="font-family:Arial,sans-serif;padding:60px;max-width:600px;margin:0 auto;">
        <h2>Project Agreement</h2>
        <p>By signing below, both parties agree to the terms and scope of work as outlined in the proposal.</p>
        <br/><br/><br/>
        <p>Signature: /sig1/</p>
        <p>Name: ${signerName}</p>
        <p>Date: /date1/</p>
        </body></html>
      `
      document = {
        documentBase64: Buffer.from(signaturePage).toString('base64'),
        name:           'Project Agreement',
        fileExtension:  'html',
        documentId:     '1',
      }
      tabs = {
        signHereTabs: [{
          anchorString:  '/sig1/',
          anchorXOffset: '0',
          anchorYOffset: '0',
          anchorUnits:   'pixels',
        }],
        dateSignedTabs: [{
          anchorString:  '/date1/',
          anchorXOffset: '0',
          anchorYOffset: '0',
          anchorUnits:   'pixels',
        }],
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'

    const envelopeRes = await fetch(`${baseUrl}/envelopes`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailSubject: 'Please sign your project agreement',
        documents:    [document],
        recipients: {
          signers: [{
            name:         signerName,
            email:        signerEmail,
            recipientId:  '1',
            clientUserId: '1',
            tabs,
          }],
        },
        status: 'sent',
      }),
    })

    const envelope = await envelopeRes.json()
    if (!envelope.envelopeId) {
      console.error('[docusign/sign] Envelope error:', JSON.stringify(envelope))
      return NextResponse.json({ error: 'Failed to create envelope' }, { status: 500 })
    }

    // Create embedded signing URL
    const viewRes = await fetch(`${baseUrl}/envelopes/${envelope.envelopeId}/views/recipient`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnUrl:    `${appUrl}/api/docusign/complete?envelopeId=${envelope.envelopeId}&bidId=${bidId}`,
        authenticationMethod: 'none',
        email:        signerEmail,
        userName:     signerName,
        recipientId:  '1',
        clientUserId: '1',
      }),
    })

    const view = await viewRes.json()
    if (!view.url) {
      console.error('[docusign/sign] View error:', JSON.stringify(view))
      return NextResponse.json({ error: 'Failed to create signing view' }, { status: 500 })
    }

    return NextResponse.json({ signingUrl: view.url, envelopeId: envelope.envelopeId })
  } catch (err) {
    console.error('[docusign/sign]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
