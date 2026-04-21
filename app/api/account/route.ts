import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { logError } from '@/lib/airtable'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

export async function POST(req: NextRequest) {
  try {
    const { userId, email, fullName } = await req.json()
    if (!userId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const existing = await base('Accounts')
      .select({ filterByFormula: `{Supabase User ID} = "${userId}"`, maxRecords: 1 })
      .all()

    if (existing.length > 0) return NextResponse.json({ success: true, exists: true })

    await base('Accounts').create({
      'Full Name':        fullName || '',
      'Email':            email,
      'Supabase User ID': userId,
      'Account Type':     'User',
      'Account Status':   'Active',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logError('Account sync failed', msg, 'High')
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
