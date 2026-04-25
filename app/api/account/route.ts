import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

const HOW_FOUND_OPTIONS = [
  'Word of mouth',
  'Google search',
  'Social media',
  'Art fair or event',
  'Referred by a vendor',
  'Referred by a colleague',
  'Press or media',
  'Direct outreach',
  'Other',
]

export async function POST(req: NextRequest) {
  try {
    const { userId, email, fullName, company, phone, street, city, state, postalCode, country, website, howFoundUs }

ll
cat > ~/Desktop/pairascope/app/api/account/route.ts << 'ENDOFFILE'
import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

const HOW_FOUND_OPTIONS = [
  'Word of mouth',
  'Google search',
  'Social media',
  'Art fair or event',
  'Referred by a vendor',
  'Referred by a colleague',
  'Press or media',
  'Direct outreach',
  'Other',
]

export async function POST(req: NextRequest) {
  try {
    const { userId, email, fullName, company, phone, street, city, state, postalCode, country, website, howFoundUs } = await req.json()

    // Upsert to Airtable Accounts table
    const existing = await base('Accounts')
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .all()

    const fields: Record<string, unknown> = {
      'fldvjFGBCMLpwwo8h': email,
      'fld9t2PM9fCfzGrp7': userId || '',
    }
    if (fullName)   fields['fldbPiuuDL1ETs4cX'] = fullName
    if (company)    fields['fldEOggjVD7aSjffX'] = company
    if (phone)      fields['fldszQgrULXRlKkRW'] = phone
    if (street)     fields['fldC424jCX4u9M4MR'] = street
    if (city)       fields['fldC424jCX4u9M4MR'] = [street, city].filter(Boolean).join(', ')
    if (website)    fields['fldBveiqEkNoTglvt'] = website
    if (howFoundUs) fields['fldfassYVNLG0Ym5u'] = howFoundUs

    // Build full location string
    const locationParts = [street, city, state, postalCode, country].filter(Boolean)
    if (locationParts.length) fields['fldC424jCX4u9M4MR'] = locationParts.join(', ')

    if (existing.length > 0) {
      await base('Accounts').update(existing[0].getId(), fields as Airtable.FieldSet)
    } else {
      await base('Accounts').create(fields as Airtable.FieldSet)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/account] POST error:', err)
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
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .all()

    if (!records.length) return NextResponse.json({ account: null })

    const r = records[0]
    return NextResponse.json({
      account: {
        fullName:   r.get('Full Name')        as string ?? '',
        email:      r.get('Email')            as string ?? '',
        company:    r.get('Company / Studio') as string ?? '',
        phone:      r.get('Phone')            as string ?? '',
        location:   r.get('Location')         as string ?? '',
        website:    r.get('Website')          as string ?? '',
        howFoundUs: r.get('How They Found Us') as string ?? '',
      },
      howFoundOptions: HOW_FOUND_OPTIONS,
    })
  } catch (err) {
    console.error('[/api/account] GET error:', err)
    return NextResponse.json({ error: 'Failed to load account' }, { status: 500 })
  }
}
