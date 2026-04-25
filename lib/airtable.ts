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

const P = {
  name:            'fldN7F3Y8YtbWtSzd',
  artistName:      'fld3jwYtcJrCHekXD',
  artistEmail:     'fldwWT9j1xgOfnRVV',
  inputText:       'fldAZbgevniCioB6f',
  aiSummary:       'fldqTljQ67e15wYEB',
  createdDate:     'fldW3VUda1MLRODw7',
  status:          'fldLdWTW2uHq4fP0m',
  services:        'flddWLaM1AvN5av3c',
  projectType:     'fldSAsETrTiqvGdqq',
  material:        'fld26VYiB6wom2uIF',
  scale:           'fld7vnKhNTOLqD16g',
  location:        'fld0rizgANygJCH4A',
  missingInfo:     'fldafiJd101Egp8Gj',
  budgetRange:     'fldrSoVPrtZYzivUH',
  confidenceLevel: 'fldkkEbVv2vyDFtne',
  convId:          'fldngbTEeVeb7SFBR',
}

// Helper — safely extract string from aiText or string field
function str(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object' && val !== null && 'value' in val) {
    return String((val as { value: unknown }).value ?? '')
  }
  return String(val)
}

export async function createProjectRecord(params: {
  inputText:      string
  snapshot:       ProjectSnapshot
  conversationId: string
  artistName?:    string
  artistEmail?:   string
}): Promise<string | null> {
  try {
    const { inputText, snapshot, conversationId, artistName, artistEmail } = params
    const projectName = inputText.slice(0, 60).trim() + (inputText.length > 60 ? '\u2026' : '')
    const today = new Date().toISOString().split('T')[0]

    const fields: Record<string, unknown> = {
      [P.name]:            projectName,
      [P.inputText]:       inputText,
      [P.createdDate]:     today,
      [P.status]:          'New',
      [P.convId]:          conversationId,
      [P.material]:        snapshot.material     || '',
      [P.scale]:           snapshot.scale        || '',
      [P.location]:        snapshot.location     || '',
      [P.budgetRange]:     snapshot.budgetRange  || '',
      [P.missingInfo]:     (snapshot.missingInfo || []).join('\n'),
      [P.aiSummary]:       snapshot.aiSummary    || '',
    }
    fields[P.confidenceLevel] = (snapshot.confidenceScore || 0) / 100

    if (artistName)  fields[P.artistName]  = artistName
    if (artistEmail) fields[P.artistEmail] = artistEmail
    const VALID_SERVICES = ['Fabrication', 'Crating', 'Shipping', 'Installation', 'Preservation']
    const validServices = (snapshot.services || []).filter((s: string) => VALID_SERVICES.includes(s))
    if (validServices.length) fields[P.services] = validServices
    const VALID_PROJECT_TYPES = ['Fabrication', 'Crating', 'Shipping', 'Installation', 'Preservation']
    const projectTypeValue = VALID_PROJECT_TYPES.includes(snapshot.projectType || '') ? [snapshot.projectType] : []
    if (projectTypeValue.length) fields[P.projectType] = projectTypeValue

    const record = await base(TABLES.PROJECTS).create(fields as Airtable.FieldSet)
    return record.getId()
  } catch (err) {
    console.error('[Airtable] createProjectRecord failed:', JSON.stringify(err))
    return null
  }
}

export async function getActiveVendors() {
  try {
    const records = await base(TABLES.VENDORS)
      .select({
        filterByFormula: '{Active} = TRUE()',
        fields: ['Vendor Name', 'Primary Services', 'Contact Name', 'Email', 'Phone', 'Website', 'Capabilities', 'Short Bio', 'Vendor Rating'],
      })
      .all()

    return records.map((r) => ({
      id:             r.getId(),
      name:           str(r.get('Vendor Name')),
      primaryService: ((r.get('Primary Services') as string[] | undefined) ?? [])[0] ?? '',
      contactName:    str(r.get('Contact Name')),
      email:          str(r.get('Email')),
      phone:          str(r.get('Phone')),
      capabilities:   str(r.get('Capabilities')),
      shortBio:       str(r.get('Short Bio')),
      website:        str(r.get('Website')),
      rating:         r.get('Vendor Rating') as number ?? 0,
      active:         true,
      location:       '',
      materials:      '',
    }))
  } catch (err) {
    console.error('[Airtable] getActiveVendors failed:', JSON.stringify(err))
    return []
  }
}

export async function getAssignedVendors(conversationId: string) {
  try {
    const projects = await base(TABLES.PROJECTS)
      .select({ filterByFormula: `{${P.convId}} = "${conversationId}"` })
      .all()

    if (!projects.length) return []
    const assignedIds = projects[0].get('Assigned Vendors') as string[] | undefined
    if (!assignedIds?.length) return []

    const vendors = await Promise.all(assignedIds.map((id) => base(TABLES.VENDORS).find(id)))
    return vendors.map((r) => ({
      id:             r.getId(),
      name:           str(r.get('Vendor Name')),
      primaryService: ((r.get('Primary Services') as string[] | undefined) ?? [])[0] ?? '',
      contactName:    str(r.get('Contact Name')),
      email:          str(r.get('Email')),
      capabilities:   str(r.get('Capabilities')),
      shortBio:       str(r.get('Short Bio')),
      website:        str(r.get('Website')),
      rating:         r.get('Vendor Rating') as number ?? 0,
      active:         true,
      location:       '',
      materials:      '',
    }))
  } catch (err) {
    console.error('[Airtable] getAssignedVendors failed:', JSON.stringify(err))
    return []
  }
}

export async function getKnowledgeHubByService(serviceType: string) {
  try {
    const records = await base(TABLES.KNOWLEDGE_HUB)
      .select({
        // Use field ID directly to avoid name mismatch
        fields: ['Title', 'fldcpc1gPhPPcwU8t', 'fldoPhkOmNghs4B6w'],
      })
      .all()

    return records
      .filter((r) => {
        const cat = r.get('fldcpc1gPhPPcwU8t') as { name?: string } | string | undefined
        const catName = typeof cat === 'object' && cat !== null ? cat.name : cat
        return catName === serviceType || catName === 'General'
      })
      .map((r) => ({
        title:               str(r.get('Title')),
        serviceType,
        scopeLanguage:       str(r.get('fldoPhkOmNghs4B6w')),
        standardAssumptions: '',
        riskLanguage:        '',
      }))
  } catch (err) {
    console.error('[Airtable] getKnowledgeHubByService failed:', JSON.stringify(err))
    return []
  }
}

export async function logError(title: string, detail: string, severity: 'Critical' | 'High' | 'Low' = 'High') {
  try {
    await base(TABLES.ERROR_LOG).create({
      'Error Title':  title,
      'Error Detail': detail,
      'Severity':     severity,
    } as Airtable.FieldSet)
  } catch (err) {
    console.error('[Airtable] logError failed:', err)
  }
}

export { base, TABLES }

// ─── Look up Account record ID by email ────────────────────────────────────

export async function getAccountIdByEmail(email: string): Promise<string | null> {
  try {
    const records = await base('Accounts')
      .select({ filterByFormula: `{Email} = "${email}"`, maxRecords: 1 })
      .all()
    return records[0]?.getId() ?? null
  } catch (err) {
    console.error('[Airtable] getAccountIdByEmail failed:', err)
    return null
  }
}
