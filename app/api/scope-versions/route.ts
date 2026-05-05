export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ versions: [] })

    const records = await getBase()('Scope Versions')
      .select({
        filterByFormula: `SEARCH("${projectId}", ARRAYJOIN({Project}))`,
        sort: [{ field: 'Version Number', direction: 'desc' }],
      })
      .all()

    const versions = records.map((r) => ({
      id:             r.getId(),
      version_number: r.get('Version Number') as number,
      scope_notes:    r.get('Scope Notes') as string ?? '',
      what_changed:   r.get('What Changed') as string ?? '',
    }))

    return NextResponse.json({ versions })
  } catch (err) {
    console.error('[scope-versions] GET failed:', err)
    return NextResponse.json({ versions: [] })
  }
}
