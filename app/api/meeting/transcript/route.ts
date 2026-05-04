export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Airtable from 'airtable'
import Anthropic from '@anthropic-ai/sdk'
import * as postmark from 'postmark'
import { fetchTranscriptText } from '@/lib/googleDrive'

const getBase = () => {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY not set')
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!)
}

const getAnthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const getPmClient  = () => new postmark.ServerClient(process.env.POSTMARK_API_KEY ?? '')

interface TranscriptExtraction {
  decisions:    string[]
  scopeChanges: string[]
  actionItems:  { item: string; owner: string; deadline: string }[]
  meetingNotes: string
  scopeChanged: boolean
  whatChanged:  string
}

async function extractFromTranscript(transcript: string): Promise<TranscriptExtraction> {
  const response = await getAnthropic().messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are an assistant that extracts structured information from meeting transcripts for art fabrication, shipping, installation, and conservation projects.

Analyze this meeting transcript and extract the following in JSON format only. No preamble, no markdown, just raw JSON.

{
  "decisions": ["list of key decisions made"],
  "scopeChanges": ["list of specific scope changes — materials, timeline, location, budget changes"],
  "actionItems": [{"item": "what needs to be done", "owner": "who is responsible", "deadline": "by when"}],
  "meetingNotes": "2-3 sentence plain English summary of the meeting",
  "scopeChanged": true or false,
  "whatChanged": "if scopeChanged is true, plain English description of what changed and why. If false, empty string."
}

TRANSCRIPT:
${transcript}`,
    }],
  })

  const text  = response.content[0].type === 'text' ? response.content[0].text : ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as TranscriptExtraction
}

export async function POST(req: NextRequest) {
  try {
    const { driveFileId, projectId, artistEmail, vendorEmail } = await req.json()

    if (!driveFileId || !projectId) {
      return NextResponse.json({ error: 'driveFileId and projectId are required' }, { status: 400 })
    }

    // 1. Fetch transcript from Google Drive
    const transcript = await fetchTranscriptText(driveFileId)

    // 2. Extract structured data with Claude
    const extraction = await extractFromTranscript(transcript)

    const today = new Date().toISOString().split('T')[0]
    const base  = getBase()

    // 3. Fetch current project to get scope version
    const projectRecord  = await base('Projects').find(projectId)
    const currentVersion = (projectRecord.get('Scope Version') as number) ?? 0
    const newVersion     = extraction.scopeChanged ? currentVersion + 1 : currentVersion

    // 4. Update Project record
    const actionItemsText = extraction.actionItems
      .map(a => `- ${a.item} — ${a.owner}${a.deadline ? ` (by ${a.deadline})` : ''}`)
      .join('\n')

    await base('Projects').update(projectId, {
      'Meeting Notes':     extraction.meetingNotes,
      'Last Meeting Date': today,
      'Action Items':      actionItemsText,
      'Scope Version':     newVersion,
    } as Airtable.FieldSet)

    // 5. Create Scope Version record if scope changed
    if (extraction.scopeChanged) {
      await base('Scope Versions').create({
        'Project':        [projectId],
        'Version Number': newVersion,
        'Scope Notes':    extraction.scopeChanges.join('\n'),
        'What Changed':   extraction.whatChanged,
      } as Airtable.FieldSet)
    }

    // 6. Send summary email via Postmark
    const decisionsText    = extraction.decisions.map(d => `- ${d}`).join('\n')
    const scopeChangesText = extraction.scopeChanges.length
      ? extraction.scopeChanges.map(s => `- ${s}`).join('\n')
      : 'No scope changes identified.'

    const emailBody = [
      'Meeting Summary',
      '===============',
      '',
      extraction.meetingNotes,
      '',
      'DECISIONS',
      '---------',
      decisionsText || 'None recorded.',
      '',
      'SCOPE CHANGES',
      '-------------',
      scopeChangesText,
      '',
      'ACTION ITEMS',
      '------------',
      actionItemsText || 'None recorded.',
      '',
      '---',
      'Processed automatically by Pairascope.',
    ].join('\n')

    const pmClient  = getPmClient()
    const FROM      = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'
    const projectName = projectRecord.get('Project Name') as string ?? 'Your Project'

    const recipients = [artistEmail, vendorEmail].filter(Boolean)
    await Promise.all(recipients.map((to: string) =>
      pmClient.sendEmail({
        From:     FROM,
        To:       to,
        Subject:  `Meeting Summary — ${projectName}`,
        TextBody: emailBody,
      })
    ))

    return NextResponse.json({ success: true, scopeChanged: extraction.scopeChanged, newVersion, actionItems: extraction.actionItems })

  } catch (err) {
    console.error('[meeting/transcript]', err)
    return NextResponse.json({ error: "Failed to process transcript", detail: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
