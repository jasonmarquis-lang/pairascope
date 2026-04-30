import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rfqId = searchParams.get('rfqId')
    if (!rfqId) return NextResponse.json({ error: 'Missing rfqId' }, { status: 400 })

    const { data: bids } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('rfq_id', rfqId)
      .order('created_at', { ascending: true })

    if (!bids || bids.length < 2) {
      return NextResponse.json({ comparison: null, reason: 'Need at least 2 bids' })
    }

    const bidSummaries = bids.map((b, i) => {
      const price = b.quote_type === 'ROM'
        ? (b.price_low && b.price_high ? '$' + Number(b.price_low).toLocaleString() + ' - $' + Number(b.price_high).toLocaleString() : 'Not specified')
        : (b.firm_price ? '$' + Number(b.firm_price).toLocaleString() : 'Not specified')
      const deposit = b.deposit_amount ? '$' + Number(b.deposit_amount).toLocaleString() : b.deposit_percentage ? Number(b.deposit_percentage) + '%' : 'Not specified'
      return `Vendor ${i + 1}: ${b.vendor_name}
Type: ${b.quote_type || 'ROM'}
Price: ${price}
Deposit: ${deposit}
Timeline: ${b.timeline || 'Not specified'}
Assumptions: ${b.assumptions || 'None provided'}
Notes: ${b.notes || 'None provided'}`
    }).join('\n\n')

    const prompt = `You are helping an artist compare vendor bids for an art project. Provide a clear, factual comparison of these bids. Do not recommend a specific vendor. Help the artist understand the key differences so they can make their own decision.

Format your response as a short intro sentence, then bullet points covering:
- Price comparison
- Timeline comparison  
- Key differences in assumptions or exclusions
- Notable items in vendor notes
- Any risks or considerations the artist should be aware of

Keep it concise — 6 to 10 bullets maximum. Plain text only, no bold or markdown formatting.

BIDS:
${bidSummaries}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const comparison = response.content[0].type === 'text' ? response.content[0].text : null

    return NextResponse.json({ comparison, bidCount: bids.length })
  } catch (err) {
    console.error('[/api/bids/compare] Error:', err)
    return NextResponse.json({ error: 'Comparison failed' }, { status: 500 })
  }
}
