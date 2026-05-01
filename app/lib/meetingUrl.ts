export interface MeetingUrlParams {
  projectName: string
  rfqTitle: string
  scopeDocument: string
  vendorEmail: string
}

export function buildGoogleCalendarUrl(params: MeetingUrlParams): string {
  const { projectName, rfqTitle, scopeDocument, vendorEmail } = params

  const title = `Project Brief — ${projectName}`

  const agenda = [
    `MEETING AGENDA`,
    ``,
    `Account: ${projectName}`,
    `RFQ: ${rfqTitle}`,
    ``,
    `SCOPE DOCUMENT`,
    ``,
    scopeDocument,
    ``,
    `---`,
    `Scheduled via Pairascope`,
  ].join('\n')

  const base = 'https://calendar.google.com/calendar/render'

  const params2 = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: agenda,
    add: vendorEmail,
    location: 'Google Meet',
  })

  return `${base}?${params2.toString()}`
}
