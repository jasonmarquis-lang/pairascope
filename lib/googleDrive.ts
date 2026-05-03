// lib/googleDrive.ts
// Fetches a Google Drive document's plain text content using OAuth2 refresh token

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_URL = 'https://www.googleapis.com/drive/v3'
const EXPORT_URL = 'https://www.googleapis.com/drive/v3/files'

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
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

  if (!data.access_token) {
    console.error('[googleDrive] Failed to get access token:', data)
    throw new Error('Failed to get Google access token')
  }

  return data.access_token
}

export async function fetchTranscriptText(fileId: string): Promise<string> {
  const token = await getAccessToken()

  const res = await fetch(
    `${EXPORT_URL}/${fileId}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('[googleDrive] Failed to fetch transcript:', res.status, err)
    throw new Error(`Failed to fetch transcript: ${res.status}`)
  }

  return res.text()
}

export async function getFileName(fileId: string): Promise<string> {
  const token = await getAccessToken()

  const res = await fetch(
    `${DRIVE_URL}/files/${fileId}?fields=name`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const data = await res.json()
  return data.name ?? 'Unknown file'
}
