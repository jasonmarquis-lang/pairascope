export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// This cron job runs every 6 days to renew the Google Drive push notification watch
// Google Drive watches expire after 7 days maximum
// We set up a watch on the authenticated user's Drive for new transcript files

const PUBSUB_TOPIC = process.env.GOOGLE_PUBSUB_TOPIC_NAME ?? ''

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
  if (!data.access_token) throw new Error('Failed to get access token')
  return data.access_token
}

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel cron (or internally)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = await getAccessToken()

    // Set up a Drive push notification watch
    // This tells Google Drive to push notifications to our Pub/Sub topic
    // when any file changes in the user's Drive
    const watchId  = `pairascope-watch-${Date.now()}`
    const expiry   = Date.now() + (6 * 24 * 60 * 60 * 1000) // 6 days in ms

    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files/watch',
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id:      watchId,
          type:    'web_hook',
          address: PUBSUB_TOPIC,
          expiration: expiry.toString(),
          // Filter to Google Docs only (transcripts are Docs)
          q: "mimeType='application/vnd.google-apps.document' and name contains 'transcript'",
        }),
      }
    )

    const data = await res.json()

    if (!res.ok) {
      console.error('[renew-drive-watch] Failed to renew watch:', data)
      return NextResponse.json({ error: 'Failed to renew watch', detail: data }, { status: 500 })
    }

    console.log('[renew-drive-watch] Watch renewed successfully:', data.id)
    return NextResponse.json({ success: true, watchId: data.id, expiry: data.expiration })

  } catch (err) {
    console.error('[renew-drive-watch] Error:', err)
    return NextResponse.json({ error: 'Failed to renew drive watch' }, { status: 500 })
  }
}
