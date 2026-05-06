export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId = searchParams.get('rfqId')
    if (!rfqId) return NextResponse.json({ error: 'Missing rfqId' }, { status: 400 })

    // Fetch RFQ (includes scope document and cached comparison)
    const { data: rfq } = await supabaseAdmin
      .from('rfqs')
      .select('scope_document, comparison_text')
      .eq('id', rfqId)
      .single()

    // Fetch all bids
    const { data: bids } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('rfq_id', rfqId)
      .order('created_at', { ascending: true })

    if (!bids || bids.length < 2) {
      return NextResponse.json({ comparison: null, reason: 'Need at least 2 bids' })
    }

    // Return cached comparison if it exists
    if (rfq?.comparison_text) {
      return NextResponse.json({ comparison: rfq.comparison_text, bidCount: bids.length, cached: true })
    }

    const bidSummaries = bids.map((b, i) => {
      const price = b.quote_type === 'ROM'
        ? (b.price_low && b.price_high ? '$' + Number(b.price_low).toLocaleString() + ' - $' + Number(b.price_high).toLocaleString() : 'Not specified')
        : (b.firm_price ? '$' + Number(b.firm_price).toLocaleString() : 'Not specified')
      const deposit = b.deposit_amount
        ? '$' + Number(b.deposit_amount).toLocaleString()
        : b.deposit_percentage
        ? Number(b.deposit_percentage) + '%'
        : 'Not specified'
      return `Vendor ${i + 1}: ${b.vendor_name}
Type: ${b.quote_type || 'ROM'}
Price: ${price}
Deposit: ${deposit}
Timeline: ${b.timeline || 'Not specified'}
Assumptions: ${b.assumptions || 'None provided'}
Notes: ${b.notes || 'None provided'}`
    }).join('\n\n')

    const scopeSection = rfq?.scope_document
      ? `ORIGINAL SCOPE DOCUMENT:\n${rfq.scope_document}\n\n`
      : ''

    const prompt = `You are helping an artist understand the differences between vendor bids for an art project.

STRICT RULES — violation of these rules is not acceptable:
- Do NOT rank vendors or imply one is better than another
- Do NOT use language like: "best value", "most competitive", "recommended", "stronger", "weaker", "winner", "preferred"
- Do NOT suggest which vendor the artist should choose
- DO present each vendor's information symmetrically — same format, same order of topics
- DO focus on factual differences, not qualitative judgments
- DO flag assumptions that could change the final price
- DO identify risks based on what was NOT addressed in each bid
- DO note gaps between the original scope and what each bid covers

${scopeSection}BIDS:
${bidSummaries}

Format your response as:
- One neutral intro sentence summarizing the number of bids and general range
- Bullet points covering: price spread and what drives it, timeline differences, what each bid includes vs. excludes, assumptions that could affect cost, risks or open questions from each bid
- Maximum 10 bullets
- Plain text only, no bold or markdown formatting`

    const response = await getAnthropic().messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })

    const comparison = response.content[0].type === 'text' ? response.content[0].text : null

    // Persist to Supabase
    if (comparison) {
      await supabaseAdmin
        .from('rfqs')
        .update({ comparison_text: comparison })
        .eq('id', rfqId)
    }

    return NextResponse.json({ comparison, bidCount: bids.length, cached: false })
  } catch (err) {
    console.error('[/api/bids/compare] Error:', err)
    return NextResponse.json({ error: 'Comparison failed' }, { status: 500 })
  }
}
