export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const encoded = body?.message?.data
    if (!encoded) {
      console.error('[transcript-ready] No message data in Pub/Sub payload')
      return NextResponse.json({ ok: true })
    }

    const decoded    = Buffer.from(encoded, 'base64').toString('utf-8')
    const driveEvent = JSON.parse(decoded)

    console.log('[transcript-ready] Drive event received:', JSON.stringify(driveEvent))

    const fileId = extractFileId(driveEvent)
    if (!fileId) {
      console.log('[transcript-ready] Could not extract file ID — skipping')
      return NextResponse.json({ ok: true })
    }

    const isTranscript = await verifyTranscript(fileId)
    if (!isTranscript) {
      console.log('[transcript-ready] Not a Meet transcript — skipping:', fileId)
      return NextResponse.json({ ok: true })
    }

    console.log('[transcript-ready] Meet transcript detected, triggering processing:', fileId)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'
    fetch(`${appUrl}/api/meeting/transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({ driveFileId: fileId, autoResolve: true }),
    }).catch(err => console.error('[transcript-ready] Processing trigger failed:', err))

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[transcript-ready] Error:', err)
    return NextResponse.json({ ok: true })
  }
}

function extractFileId(event: Record<string, unknown>): string | null {
  try {
    const targets = event.targets as Array<Record<string, unknown>> | undefined
    if (targets?.[0]) {
      const driveItem = targets[0].driveItem as Record<string, unknown> | undefined
      if (driveItem?.name) {
        return (driveItem.name as string).replace('items/', '')
      }
    }
    if (typeof event.fileId === 'string') return event.fileId
    return null
  } catch { return null }
}

async function verifyTranscript(fileId: string): Promise<boolean> {
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
        grant_type:    'refresh_token',
      }),
    })
    const { access_token } = await tokenRes.json()
    if (!access_token) return false

    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    const file = await fileRes.json()
    const name = (file.name as string ?? '').toLowerCase()
    return name.includes('transcript') && file.mimeType === 'application/vnd.google-apps.document'
  } catch { return false }
}
