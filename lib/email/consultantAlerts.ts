import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM_EMAIL = 'Citari <alerts@citari.app>'

export async function sendConsultantDropAlert(
  consultantEmail: string,
  consultantName: string,
  clientName: string,
  oldScore: number,
  newScore: number,
  topCompetitorAction: string | null,
  gapCount: number
) {
  const drop = oldScore - newScore
  const trigger = topCompetitorAction
    ? `<p style="color:#6B7280;font-size:14px;line-height:1.6;margin:12px 0;"><strong>Trigger:</strong> ${topCompetitorAction}</p>`
    : ''

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: consultantEmail,
    subject: `[${clientName}] AI Visibility dropped ${drop}% — action recommended`,
    html: `
      <div style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#7C3AED;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;font-size:18px;margin:0;">Citari Intelligence Alert</h1>
        </div>
        <div style="background:white;border:1px solid #E5E7EB;border-top:none;padding:32px;border-radius:0 0 12px 12px;">
          <p style="color:#111827;font-size:15px;line-height:1.6;margin:0 0 8px;">
            Hi ${consultantName},
          </p>
          <p style="color:#111827;font-size:15px;line-height:1.6;margin:0 0 16px;">
            <strong>${clientName}</strong> dropped from <strong>${oldScore}%</strong> to <strong style="color:#DC2626;">${newScore}%</strong> this week.
          </p>
          ${trigger}
          <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:12px 0;">
            <strong>Recommended:</strong> Content sprint targeting ${gapCount > 0 ? `${gapCount} competitor gap prompt${gapCount !== 1 ? 's' : ''}` : 'key prompts'}.
            Citari has pre-generated briefs ready.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/overview"
             style="display:inline-block;background:#7C3AED;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-top:16px;">
            View Action Plan →
          </a>
        </div>
      </div>
    `,
  })
}

export async function sendConsultantClientSummary(
  consultantEmail: string,
  consultantName: string,
  clientName: string,
  clientEmail: string,
  score: number,
  change: number,
  topInsight: string
) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: consultantEmail,
    subject: `[${clientName}] Weekly Intelligence Brief`,
    html: `
      <div style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#7C3AED;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;font-size:18px;margin:0;">Weekly Client Brief — ${clientName}</h1>
        </div>
        <div style="background:white;border:1px solid #E5E7EB;border-top:none;padding:32px;border-radius:0 0 12px 12px;">
          <p style="color:#111827;font-size:15px;margin:0 0 16px;">
            Visibility: <strong>${score}%</strong> (${change >= 0 ? '+' : ''}${change}% WoW)
          </p>
          <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;">
            ${topInsight}
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/overview"
             style="display:inline-block;background:#7C3AED;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
            Open Dashboard →
          </a>
        </div>
      </div>
    `,
  })
}
