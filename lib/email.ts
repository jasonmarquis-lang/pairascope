import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function sendAdminErrorEmail(subject: string, body: string) {
  try {
    await transporter.sendMail({
      from:    `"Pairascope System" <${process.env.GMAIL_USER}>`,
      to:      process.env.ADMIN_EMAIL,
      subject: `[Pairascope Error] ${subject}`,
      text:    body,
      html:    `<pre style="font-family:monospace;font-size:13px;">${body}</pre>`,
    })
  } catch (err) {
    console.error('[Email] sendAdminErrorEmail failed:', err)
  }
}
