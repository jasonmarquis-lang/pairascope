import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import Airtable from 'airtable'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!)

function str(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object' && val !== null && 'value' in val) return String((val as { value: unknown }).value ?? '')
  return String(val)
}

function scoreLocation(vendorCity: string, vendorState: string, vendorCountry: string, projectLocation: string): string {
  if (!projectLocation || projectLocation === 'Unknown') return 'location unknown'
  const loc = projectLocation.toLowerCase()
  const vState = vendorState.toLowerCase()
  const vCity = vendorCity.toLowerCase()
  const vCountry = vendorCountry.toLowerCase()

  // Check city match
  if (vCity && loc.includes(vCity)) return 'same city'
  // Check state match
  if (vState && loc.includes(vState)) return 'same state/region'
  // Check country match — US variations
  const usTerms = ['united states', 'usa', 'u.s.', 'us,', ', us']
  const isProjectUS = usTerms.some(t => loc.includes(t)) || /,\s*(ca|ny|tx|fl|il|wa|co|ma|az|nv|ga|nc|oh|pa|mi|mn|or|ct|nj)/i.test(projectLocation)
  const isVendorUS = vCountry === 'united states' || vCountry === 'usa' || vCountry === 'us'
  if (isProjectUS && isVendorUS) return 'same country (US)'
  if (vCountry && loc.includes(vCountry)) return 'same country'
  return 'different region'
}

export async function POST(req: NextRequest) {
  try {
    const { snapshot } = await req.json()

    const vendorRecords = await base('Vendors').select({ filterByFormula: '{Active} = TRUE()', fields: ['Vendor Name', 'Primary Services', 'Outsourced Services', 'Contact Name', 'Email', 'Phone', 'Website', 'Capabilities', 'Short Bio', 'Vendor Rating', 'Match Notes', 'City', 'State/Province', 'Country'] }).all()
    const feedbackRecords = await base('Vendor Feedback').select({ maxRecords: 50, sort: [{ field: 'Date', direction: 'desc' }], fields: ['Feedback Name', 'Vendor', 'Action', 'Reason', 'Project Type'] }).all()

    const vendors = vendorRecords.map((r) => ({
      id: r.getId(),
      name: str(r.get('Vendor Name')),
      primaryServices: (r.get('Primary Services') as string[] | undefined) ?? [],
      secondaryServices: (r.get('Outsourced Services') as string[] | undefined) ?? [],
      primaryService: ((r.get('Primary Services') as string[] | undefined) ?? [])[0] ?? '',
      city: str(r.get('City')),
      state: str(r.get('State/Province')),
      country: str(r.get('Country')),
      contactName: str(r.get('Contact Name')),
      email: str(r.get('Email')),
      phone: str(r.get('Phone')),
      website: str(r.get('Website')),
      capabilities: str(r.get('Capabilities')),
      shortBio: str(r.get('Short Bio')),
      rating: r.get('Vendor Rating') as number ?? 0,
      matchNotes: str(r.get('Match Notes')),
      reasoning: '',
    }))

    const feedbackSummary = feedbackRecords.map((r) => {
      const vendorLinks = r.get('Vendor') as { name: string }[] | undefined
      return `- ${str(r.get('Action'))}: ${vendorLinks?.[0]?.name ?? 'Unknown'} for ${str(r.get('Project Type'))} — ${str(r.get('Reason'))}`
    }).join('\n')

    const vendorList = vendors.map((v, i) => {
      const locScore = scoreLocation(v.city, v.state, v.country, snapshot.location || '')
      return `[${i}] ${v.name} | Location: ${[v.city, v.state, v.country].filter(Boolean).join(', ') || 'Unknown'} (${locScore}) | Services: ${v.primaryServices.join(', ')} | Rating: ${v.rating}/5\nSecondary: ${v.secondaryServices.join(', ') || 'None'}\nCapabilities: ${v.capabilities}\nMatch Notes: ${v.matchNotes || 'None'}`
    }).join('\n\n')

    const prompt = `You are a vendor matching expert for Pairascope, connecting artists with fabricators, shippers, and installers.

PROJECT:
- Type: ${snapshot.projectType || 'Unknown'}
- Service Track: ${snapshot.serviceTrack || 'Unknown'}
- Material: ${snapshot.material || 'Unknown'}
- Scale: ${snapshot.scale || 'Unknown'}
- Location: ${snapshot.location || 'Unknown'}
- Services: ${(snapshot.services || []).join(', ') || 'Unknown'}
- Timeline: ${snapshot.timeline || 'Unknown'}
- Budget: ${snapshot.budgetRange || 'Unknown'}

PAST FEEDBACK:
${feedbackSummary || 'No feedback yet.'}

VENDORS:
${vendorList}

Select the best-matched vendors. Return ONLY valid JSON array, no preamble.
Rules:
- Prioritize vendors whose Primary Services match the project service track
- Prefer vendors with 'same city' or 'same state/region' location score for installation and shipping projects where proximity matters. For fabrication, same country is usually sufficient. Note the location score shown in parentheses next to each vendor's location.
- Consider Secondary Services relevance
- Use past feedback to include/exclude vendors
- Max 5 vendors
- Write 1-3 sentence reasoning per vendor explaining why they fit THIS specific project

[{"vendorIndex": 0, "reasoning": "explanation"}]`

    const response = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const matches: { vendorIndex: number; reasoning: string }[] = JSON.parse(cleaned)
    const matchedVendors = matches.filter((m) => vendors[m.vendorIndex]).map(({ vendorIndex, reasoning }) => ({ ...vendors[vendorIndex], reasoning }))

    return NextResponse.json({ vendors: matchedVendors })
  } catch (err) {
    console.error('[/api/vendors/match] Error:', err)
    return NextResponse.json({ vendors: [], error: 'Matching failed' }, { status: 500 })
  }
}
