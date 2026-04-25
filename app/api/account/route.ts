import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

// Accounts table field IDs
const A = {
  fullName:   'fldbPiuuDL1ETs4cX',
  email:      'fldvjFGBCMLpwwo8h',
  userId:     'fld9t2PM9fCfzGrp7',
  company:    'fldEOggjVD7aSjffX',
  phone:      'fldszQgrULXRlKkRW',
  location:   'fldC424jCX4u9M4MR',
  website:    'fldBveiqEkNoTglvt',
  howFoundUs: 'fldfassYVNLG0Ym5u',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, email, fullName, company, phone, street, city, state, postalCode, country, website, howFoundUs } = body

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const locationParts = [street, city, state, postalCode, country].filter(Boolean)
    const location = locationParts.join(', ')

    const fields: Airtable.FieldSet = {
      [A.email]:    email,
      [A.userId]:   userId || '',
      [A.fullName]: fullName || '',
    }

    if (company)    fields[A.company]    = company
    if (phone)      fields[A.phone]      = phone
    if (location)   fields[A.location]   = location
    if (website)    fields[A.website]    = website
    if (howFoundUs) fields[A.howFoundUs] = howFoundUs

    const existing = await base('Accounts')
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .all()

    if (existing.length > 0) {
      await base('Accounts').update(existing[0].getId(), fields)
    } else {
      await base('Accounts').create(fields)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/account] POST error:', JSON.stringify(err))
    return NextResponse.json({ error: 'Failed to save account' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    const email = userData.user?.email
    if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const records = await base('Accounts')
      .select({
        filterByFormula: `{Email} = "${email}"`,
        maxRecords: 1,
        fields: Object.values(A),
      })
      .all()

    if (!records.length) return NextResponse.json({ account: null })

    const r        = records[0]
    const location = (r.get(A.location) as string) ?? ''
    const parts    = location.split(', ')

    return NextResponse.json({
      account: {
        fullName:   (r.get(A.fullName)   as string) ?? '',
        email:      (r.get(A.email)      as string) ?? '',
        company:    (r.get(A.company)    as string) ?? '',
        phone:      (r.get(A.phone)      as string) ?? '',
        website:    (r.get(A.website)    as string) ?? '',
        howFoundUs: (r.get(A.howFoundUs) as string) ?? '',
        street:     parts[0] ?? '',
        city:       parts[1] ?? '',
        state:      parts[2] ?? '',
        postalCode: parts[3] ?? '',
        country:    parts[4] ?? '',
      },
    })
  } catch (err) {
    console.error('[/api/account] GET error:', JSON.stringify(err))
    return NextResponse.json({ error: 'Failed to load account' }, { status: 500 })
  }
}
