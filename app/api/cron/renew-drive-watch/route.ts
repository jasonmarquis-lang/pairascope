export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// Drive push notifications use a direct HTTPS webhook address
// Google sends a POST to our endpoint when files in Drive change
// Watches expire after 7 days max — this cron runs every 6 days to renew

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data))
  return data.access_token
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token   = await getAccessToken()
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'
    const watchId = `pairascope-watch-${Date.now()}`

    // Register a Drive push notification watch
    // Google Drive will POST to our webhook when any file changes
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/changes/watch?pageToken=1',
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id:      watchId,
          type:    'web_hook',
          address: `${appUrl}/api/meeting/transcript-ready`,
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      console.error('[renew-drive-watch] Drive API error:', JSON.stringify(data))
      return NextResponse.json(
        { error: 'Failed to register Drive watch', detail: data },
        { status: 500 }
      )
    }

    console.log('[renew-drive-watch] Watch registered successfully:', data.id, 'expires:', data.expiration)
    return NextResponse.json({
      success:    true,
      watchId:    data.id,
      expiration: data.expiration,
    })

  } catch (err) {
    console.error('[renew-drive-watch] Error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Failed to renew drive watch' }, { status: 500 })
  }
}
