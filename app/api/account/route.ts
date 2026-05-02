export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import { supabaseAdmin } from '@/lib/supabase'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

const A = {
  fullName:   'fldbPiuuDL1ETs4cX',
  email:      'fldvjFGBCMLpwwo8h',
  userId:     'fld9t2PM9fCfzGrp7',
  company:    'fldEOggjVD7aSjffX',
  phone:      'fldszQgrULXRlKkRW',
  website:    'fldBveiqEkNoTglvt',
  howFoundUs: 'fldfassYVNLG0Ym5u',
  street:     'fldbYUZlVPLfN8cWE',
  city:       'fldllCyMs9awJhtYv',
  state:      'fld0jcvLAoCrnGgN9',
  postalCode: 'fldQmIDSWWSEDnu9k',
  country:    'fldULQgQatLqabG4a',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, email, fullName, company, phone, street, city, state, postalCode, country, website, howFoundUs } = body

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const fields: Airtable.FieldSet = {
      [A.email]:    email,
      [A.userId]:   userId || '',
      [A.fullName]: fullName || '',
    }

    if (company)    fields[A.company]    = company
    if (phone)      fields[A.phone]      = phone
    if (street)     fields[A.street]     = street
    if (city)       fields[A.city]       = city
    if (state)      fields[A.state]      = state
    if (postalCode) fields[A.postalCode] = postalCode
    if (country)    fields[A.country]    = country
    if (howFoundUs) fields[A.howFoundUs] = howFoundUs

    // Only set website if it looks like a URL
    if (website) {
      const url = website.startsWith('http') ? website : `https://${website}`
      fields[A.website] = url
    }

    const existing = await getBase()('Accounts')
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .all()

    if (existing.length > 0) {
      await getBase()('Accounts').update(existing[0].getId(), fields)
    } else {
      await getBase()('Accounts').create(fields)
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

    const records = await getBase()('Accounts')
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .all()

    if (!records.length) return NextResponse.json({ account: null })

    const r = records[0]
    return NextResponse.json({
      account: {
        fullName:   (r.get(A.fullName)   as string) ?? '',
        email:      (r.get(A.email)      as string) ?? '',
        company:    (r.get(A.company)    as string) ?? '',
        phone:      (r.get(A.phone)      as string) ?? '',
        website:    (r.get(A.website)    as string) ?? '',
        howFoundUs: (r.get(A.howFoundUs) as string) ?? '',
        street:     (r.get(A.street)     as string) ?? '',
        city:       (r.get(A.city)       as string) ?? '',
        state:      (r.get(A.state)      as string) ?? '',
        postalCode: (r.get(A.postalCode) as string) ?? '',
        country:    (r.get(A.country)    as string) ?? '',
      },
    })
  } catch (err) {
    console.error('[/api/account] GET error:', JSON.stringify(err))
    return NextResponse.json({ error: 'Failed to load account' }, { status: 500 })
  }
}
