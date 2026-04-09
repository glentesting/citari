import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM_EMAIL = 'Citari <alerts@citari.app>'

export async function sendDirectDropAlert(
  ownerEmail: string,
  clientName: string,
  oldScore: number,
  newScore: number
) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: ownerEmail,
    subject: 'Your AI visibility dropped this week',
    html: `
      <div style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#7C3AED;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;font-size:18px;margin:0;">AI Visibility Update</h1>
        </div>
        <div style="background:white;border:1px solid #E5E7EB;border-top:none;padding:32px;border-radius:0 0 12px 12px;">
          <p style="color:#111827;font-size:15px;line-height:1.6;margin:0 0 16px;">
            Your brand appeared less often in AI responses this week — down from ${oldScore}% to ${newScore}%.
          </p>
          <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;">
            We know exactly why and have content ready to fix it.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/overview"
             style="display:inline-block;background:#7C3AED;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
            See Your Recommendations →
          </a>
        </div>
      </div>
    `,
  })
}

export async function sendDirectClientNotification(
  clientEmail: string,
  clientName: string,
  score: number,
  portalUrl: string | null,
  level: 'summary' | 'full'
) {
  const body = level === 'full'
    ? `<p style="color:#111827;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Your AI visibility score this week is <strong>${score}%</strong>.
        This means ${score}% of the time an AI model is asked about your industry, your brand gets mentioned.
      </p>
      ${portalUrl ? `<a href="${portalUrl}" style="display:inline-block;background:#7C3AED;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View Your Dashboard →</a>` : ''}`
    : `<p style="color:#111827;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Your weekly AI visibility score: <strong>${score}%</strong>
      </p>`

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: clientEmail,
    subject: `${clientName} — Weekly AI Visibility: ${score}%`,
    html: `
      <div style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#7C3AED;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;font-size:18px;margin:0;">${clientName} Intelligence Report</h1>
        </div>
        <div style="background:white;border:1px solid #E5E7EB;border-top:none;padding:32px;border-radius:0 0 12px 12px;">
          ${body}
        </div>
      </div>
    `,
  })
}
