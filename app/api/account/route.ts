import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, email, fullName, company, phone, street, city, state, postalCode, country, website, howFoundUs } = body

    const locationParts = [street, city, state, postalCode, country].filter(Boolean)
    const location = locationParts.join(', ')

    const fields: Airtable.FieldSet = {
      'fldbPiuuDL1ETs4cX': fullName || '',
      'fldvjFGBCMLpwwo8h': email,
      'fld9t2PM9fCfzGrp7': userId || '',
    }

    if (company)    fields['fldEOggjVD7aSjffX'] = company
    if (phone)      fields['fldszQgrULXRlKkRW'] = phone
    if (location)   fields['fldC424jCX4u9M4MR'] = location
    if (website)    fields['fldBveiqEkNoTglvt'] = website
    if (howFoundUs) fields['fldfassYVNLG0Ym5u'] = howFoundUs

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
    const location = (r.get('Location') as string) ?? ''
    const parts    = location.split(', ')

    return NextResponse.json({
      account: {
        fullName:   (r.get('Full Name')         as string) ?? '',
        email:      (r.get('Email')             as string) ?? '',
        company:    (r.get('Company / Studio')  as string) ?? '',
        phone:      (r.get('Phone')             as string) ?? '',
        website:    (r.get('Website')           as string) ?? '',
        howFoundUs: (r.get('How They Found Us') as string) ?? '',
        street:     parts[0] ?? '',
        city:       parts[1] ?? '',
        state:      parts[2] ?? '',
        postalCode: parts[3] ?? '',
        country:    parts[4] ?? '',
      },
    })
  } catch (err) {
    console.error('[/api/account] GET error:', err)
    return NextResponse.json({ error: 'Failed to load account' }, { status: 500 })
  }
}
