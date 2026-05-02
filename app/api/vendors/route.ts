export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getActiveVendors, getAssignedVendors } from '@/lib/airtable'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const conversationId   = searchParams.get('conversationId')

  try {
    // If a conversationId is given, try to get assigned vendors first
    if (conversationId) {
      const assigned = await getAssignedVendors(conversationId)
      if (assigned.length > 0) {
        return NextResponse.json({ vendors: assigned })
      }
    }

    // Fall back to all active vendors
    const vendors = await getActiveVendors()
    return NextResponse.json({ vendors })
  } catch (err) {
    console.error('[/api/vendors] Error:', err)
    return NextResponse.json({ vendors: [], error: 'Failed to load vendors' }, { status: 500 })
  }
}
