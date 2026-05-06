import * as postmark from 'postmark'

const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY!)

const FROM = process.env.POSTMARK_FROM_EMAIL ?? 'create@pairascope.com'

// ─── Admin error notification ──────────────────────────────────────────────

export async function sendAdminErrorEmail(subject: string, body: string) {
  try {
    await client.sendEmail({
      From:     FROM,
      To:       process.env.ADMIN_EMAIL!,
      Subject:  `[Pairascope Error] ${subject}`,
      TextBody: body,
    })
  } catch (err) {
    console.error('[Postmark] sendAdminErrorEmail failed:', err)
  }
}

// ─── RFQ email to vendor ───────────────────────────────────────────────────

export async function sendRFQToVendor(params: {
  vendorEmail:   string
  vendorName:    string
  projectName:   string
  projectId:     string
  rfqId:         string
  scopeDocument: string
  replyToRelay:  string
  appUrl?:       string
}) {
  const { vendorEmail, vendorName, projectName, projectId, rfqId, scopeDocument, replyToRelay, appUrl } = params

  // Try to fetch template from Airtable
  let text: string
  try {
    const { getTemplate } = await import('@/lib/airtable')
    const template = await getTemplate('RFQ Sent to Vendor')
    if (template) {
      text = template
        .replace('{{vendor_name}}', vendorName)
        .replace('{{project_name}}', projectName)
        .replace('{{project_id}}', projectId)
        .replace('{{rfq_id}}', rfqId)
        .replace('{{scope_document}}', scopeDocument)
        .replace('{{reply_to}}', replyToRelay)
        .replace('{{app_url}}', appUrl ?? 'https://www.pairascope.com')
    } else {
      throw new Error('Template not found')
    }
  } catch {
    text = `Hi ${vendorName},

You have received a new project inquiry through Pairascope.

PROJECT: ${projectName}
REFERENCE: ${projectId}

SCOPE OF WORK
─────────────
${scopeDocument}

─────────────
Please review the scope and respond via the dashboard:
${appUrl ?? 'https://www.pairascope.com'}/vendor/rfq/${rfqId}

For quick questions, reply to this email.

Best,
Pairascope`
  }

  await client.sendEmail({
    From:    FROM,
    To:      vendorEmail,
    ReplyTo: replyToRelay,
    Subject: `[Pairascope] New Project Inquiry – ${projectName}`,
    TextBody: text,
  })
}

// ─── Notification to artist when vendors are assigned ─────────────────────

export async function sendVendorMatchNotification(params: {
  artistEmail:  string
  artistName:   string
  projectName:  string
  vendorCount:  number
  dashboardUrl: string
}) {
  const { artistEmail, artistName, projectName, vendorCount, dashboardUrl } = params

  const text = `Hi ${artistName},

Your project "${projectName}" has been reviewed and matched with ${vendorCount} qualified vendor${vendorCount !== 1 ? 's' : ''}.

You can view your vendor recommendations and compare proposals here:
${dashboardUrl}

Best,
Pairascope
create@pairascope.com`

  await client.sendEmail({
    From:    FROM,
    To:      artistEmail,
    Subject: `[Pairascope] Your vendors are ready – ${projectName}`,
    TextBody: text,
  })
}

// ─── Vendor proposal notification to artist ───────────────────────────────

export async function sendProposalNotification(params: {
  artistEmail:  string
  artistName:   string
  projectName:  string
  vendorName:   string
  dashboardUrl: string
}) {
  const { artistEmail, artistName, projectName, vendorName, dashboardUrl } = params

  const text = `Hi ${artistName},

${vendorName} has submitted a proposal for your project "${projectName}".

View and compare all proposals here:
${dashboardUrl}

Best,
Pairascope
create@pairascope.com`

  await client.sendEmail({
    From:    FROM,
    To:      artistEmail,
    Subject: `[Pairascope] New proposal received – ${projectName}`,
    TextBody: text,
  })
}

// ─── Relay email (artist ↔ vendor through platform) ───────────────────────

export async function sendRelayEmail(params: {
  toEmail:     string
  fromRelay:   string
  replyTo:     string
  subject:     string
  body:        string
}) {
  const { toEmail, fromRelay, replyTo, subject, body } = params

  await client.sendEmail({
    From:     fromRelay,
    To:       toEmail,
    ReplyTo:  replyTo,
    Subject:  subject,
    TextBody: body,
  })
}
