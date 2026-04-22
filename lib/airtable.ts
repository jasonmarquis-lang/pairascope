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
      [P.material]:        snapshot.material        || '',
      [P.scale]:           snapshot.scale           || '',
      [P.location]:        snapshot.location        || '',
      [P.budgetRange]:     snapshot.budgetRange      || '',
      [P.missingInfo]:     (snapshot.missingInfo    || []).join('\n'),
      [P.aiSummary]:       snapshot.aiSummary        || '',
      [P.confidenceLevel]: snapshot.confidenceLevel?.toUpperCase() || 'RED',
    }

    if (artistName)  fields[P.artistName]  = artistName
    if (artistEmail) fields[P.artistEmail] = artistEmail

    if (snapshot.services?.length) {
      fields[P.services] = snapshot.services
    }

    if (snapshot.projectType) {
      fields[P.projectType] = [snapshot.projectType]
    }

    const record = await base(TABLES.PROJECTS).create(fields as Airtable.FieldSet)
    return record.getId()
  } catch (err) {
    console.error('[Airtable] createProjectRecord failed:', err)
    return null
  }
}

export async function getActiveVendors() {
  try {
    const records = await base(TABLES.VENDORS)
      .select({
        filterByFormula: '{Active} = TRUE()',
        fields: [
          'Vendor Name', 'Primary Services', 'Contact Name',
          'Email', 'Phone', 'Website', 'Capabilities',
          'Short Bio', 'Vendor Rating',
        ],
      })
      .all()

    return records.map((r) => ({
      id:             r.getId(),
      name:           r.get('Vendor Name')      as string,
      primaryService: ((r.get('Primary Services') as string[] | undefined) ?? [])[0] ?? '',
      contactName:    r.get('Contact Name')     as string,
      email:          r.get('Email')            as string,
      phone:          r.get('Phone')            as string,
      capabilities:   r.get('Capabilities')     as string,
      shortBio:       r.get('Short Bio')        as string,
      website:        r.get('Website')          as string,
      rating:         r.get('Vendor Rating')    as number,
      active:         true,
      location:       '',
      materials:      '',
    }))
  } catch (err) {
    console.error('[Airtable] getActiveVendors failed:', err)
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
      name:           r.get('Vendor Name')      as string,
      primaryService: ((r.get('Primary Services') as string[] | undefined) ?? [])[0] ?? '',
      contactName:    r.get('Contact Name')     as string,
      email:          r.get('Email')            as string,
      capabilities:   r.get('Capabilities')     as string,
      shortBio:       r.get('Short Bio')        as string,
      website:        r.get('Website')          as string,
      rating:         r.get('Vendor Rating')    as number,
      active:         true,
      location:       '',
      materials:      '',
    }))
  } catch (err) {
    console.error('[Airtable] getAssignedVendors failed:', err)
    return []
  }
}

export async function getKnowledgeHubByService(serviceType: string) {
  try {
    const records = await base(TABLES.KNOWLEDGE_HUB)
      .select({
        filterByFormula: `OR({Service Category} = "${serviceType}", {Service Category} = "General")`,
        fields: ['Title', 'Service Category', 'Content'],
      })
      .all()

    return records.map((r) => ({
      title:               r.get('Title')            as string,
      serviceType:         r.get('Service Category') as string,
      scopeLanguage:       r.get('Content')          as string,
      standardAssumptions: '',
      riskLanguage:        '',
    }))
  } catch (err) {
    console.error('[Airtable] getKnowledgeHubByService failed:', err)
    return []
  }
}

export async function logError(
  title: string,
  detail: string,
  severity: 'Critical' | 'High' | 'Low' = 'High'
) {
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
