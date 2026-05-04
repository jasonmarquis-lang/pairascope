export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

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
    const token  = await getAccessToken()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.pairascope.com'

    // Step 1: Get a valid startPageToken for the changes feed
    const tokenRes = await fetch(
      'https://www.googleapis.com/drive/v3/changes/startPageToken',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const tokenData = await tokenRes.json()

    if (!tokenData.startPageToken) {
      console.error('[renew-drive-watch] Failed to get startPageToken:', JSON.stringify(tokenData))
      return NextResponse.json({ error: 'Failed to get startPageToken', detail: tokenData }, { status: 500 })
    }

    const pageToken = tokenData.startPageToken
    console.log('[renew-drive-watch] Got startPageToken:', pageToken)

    // Step 2: Register the watch using the valid pageToken
    const watchId = `pairascope-watch-${Date.now()}`

    const watchRes = await fetch(
      `https://www.googleapis.com/drive/v3/changes/watch?pageToken=${pageToken}`,
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

    const watchData = await watchRes.json()

    if (!watchRes.ok) {
      console.error('[renew-drive-watch] Drive API error:', JSON.stringify(watchData))
      return NextResponse.json(
        { error: 'Failed to register Drive watch', detail: watchData },
        { status: 500 }
      )
    }

    console.log('[renew-drive-watch] Watch registered successfully:', watchData.id, 'expires:', watchData.expiration)
    return NextResponse.json({
      success:    true,
      watchId:    watchData.id,
      expiration: watchData.expiration,
    })

  } catch (err) {
    console.error('[renew-drive-watch] Error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Failed to renew drive watch' }, { status: 500 })
  }
}
