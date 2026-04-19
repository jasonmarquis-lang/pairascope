import Airtable from 'airtable'
import type { ProjectSnapshot } from '@/types'

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY!,
}).base(process.env.AIRTABLE_BASE_ID!)

const TABLES = {
  PROJECTS:      process.env.AIRTABLE_TABLE_PROJECTS!,
  VENDORS:       process.env.AIRTABLE_TABLE_VENDORS!,
  RFQS:          process.env.AIRTABLE_TABLE_RFQS!,
  RESPONSES:     process.env.AIRTABLE_TABLE_RESPONSES!,
  DEALS:         process.env.AIRTABLE_TABLE_DEALS!,
  KNOWLEDGE_HUB: process.env.AIRTABLE_TABLE_KNOWLEDGE_HUB!,
  ERROR_LOG:     process.env.AIRTABLE_TABLE_ERROR_LOG!,
}

// ─── Push a new project summary to Airtable Projects table ─────────────────

export async function createProjectRecord(params: {
  inputText: string
  snapshot: ProjectSnapshot
  conversationId: string
  artistName?: string
  artistEmail?: string
}): Promise<string | null> {
  try {
    const { inputText, snapshot, conversationId, artistName, artistEmail } = params

    // Auto-generate project name from first 60 chars of input
    const projectName = inputText.slice(0, 60).trim() + (inputText.length > 60 ? '…' : '')

    const record = await base(TABLES.PROJECTS).create({
      'Project Name':            projectName,
      'Artist Name':             artistName || '',
      'Artist Email':            artistEmail || '',
      'Input Text':              inputText,
      'Project Type':            snapshot.projectType || '',
      'Material':                snapshot.material || '',
      'Scale':                   snapshot.scale || '',
      'Location':                snapshot.location || '',
      'Services':                (snapshot.services || []).join(', '),
      'Missing Info':            (snapshot.missingInfo || []).join('\n'),
      'Budget Range':            snapshot.budgetRange || '',
      'Confidence Level':        snapshot.confidenceLevel?.toUpperCase() || 'RED',
      'AI Summary':              snapshot.aiSummary || '',
      'Status':                  'New',
    })

    return record.getId()
  } catch (err) {
    console.error('[Airtable] createProjectRecord failed:', err)
    return null
  }
}

// ─── Fetch all active vendors ───────────────────────────────────────────────

export async function getActiveVendors() {
  try {
    const records = await base(TABLES.VENDORS)
      .select({
        filterByFormula: '{Active} = TRUE()',
        fields: [
          'Vendor Name', 'Primary Service', 'Contact Name',
          'Email', 'Phone', 'Location', 'Capabilities',
          'Materials', 'Short Bio', 'Website', 'Vendor Rating',
        ],
      })
      .all()

    return records.map((r) => ({
      id:             r.getId(),
      name:           r.get('Vendor Name') as string,
      primaryService: r.get('Primary Service') as string,
      contactName:    r.get('Contact Name') as string,
      email:          r.get('Email') as string,
      phone:          r.get('Phone') as string,
      location:       r.get('Location') as string,
      capabilities:   r.get('Capabilities') as string,
      materials:      r.get('Materials') as string,
      shortBio:       r.get('Short Bio') as string,
      website:        r.get('Website') as string,
      rating:         r.get('Vendor Rating') as number,
      active:         true,
    }))
  } catch (err) {
    console.error('[Airtable] getActiveVendors failed:', err)
    return []
  }
}

// ─── Fetch vendors assigned to a specific project ──────────────────────────

export async function getAssignedVendors(conversationId: string) {
  try {
    // Find project by Supabase conversation ID
    const projects = await base(TABLES.PROJECTS)
      .select({ filterByFormula: `{Supabase Conversation ID} = "${conversationId}"` })
      .all()

    if (!projects.length) return []

    const assignedVendorIds = projects[0].get('Assigned Vendors') as string[] | undefined
    if (!assignedVendorIds?.length) return []

    const vendors = await Promise.all(
      assignedVendorIds.map((id) => base(TABLES.VENDORS).find(id))
    )

    return vendors.map((r) => ({
      id:             r.getId(),
      name:           r.get('Vendor Name') as string,
      primaryService: r.get('Primary Service') as string,
      contactName:    r.get('Contact Name') as string,
      email:          r.get('Email') as string,
      location:       r.get('Location') as string,
      capabilities:   r.get('Capabilities') as string,
      materials:      r.get('Materials') as string,
      shortBio:       r.get('Short Bio') as string,
      website:        r.get('Website') as string,
      rating:         r.get('Vendor Rating') as number,
      active:         true,
    }))
  } catch (err) {
    console.error('[Airtable] getAssignedVendors failed:', err)
    return []
  }
}

// ─── Fetch Knowledge Hub entries by service type ───────────────────────────

export async function getKnowledgeHubByService(serviceType: string) {
  try {
    const records = await base(TABLES.KNOWLEDGE_HUB)
      .select({
        filterByFormula: `OR({Service Type} = "${serviceType}", {Service Type} = "General")`,
        fields: ['Title', 'Service Type', 'Scope Language', 'Standard Assumptions', 'Risk Language'],
      })
      .all()

    return records.map((r) => ({
      title:               r.get('Title') as string,
      serviceType:         r.get('Service Type') as string,
      scopeLanguage:       r.get('Scope Language') as string,
      standardAssumptions: r.get('Standard Assumptions') as string,
      riskLanguage:        r.get('Risk Language') as string,
    }))
  } catch (err) {
    console.error('[Airtable] getKnowledgeHubByService failed:', err)
    return []
  }
}

// ─── Log errors to Airtable Error Log ──────────────────────────────────────

export async function logError(title: string, detail: string, severity: 'Critical' | 'High' | 'Low' = 'High') {
  try {
    await base(TABLES.ERROR_LOG).create({
      'Error Title':  title,
      'Error Detail': detail,
      'Severity':     severity,
      'Resolved':     false,
    })
  } catch (err) {
    // Silently fail — don't throw from error logger
    console.error('[Airtable] logError failed:', err)
  }
}

export { base, TABLES }
