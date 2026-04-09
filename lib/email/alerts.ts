import { Resend } from 'resend'

const FROM_EMAIL = 'Citari <alerts@citari.app>'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendVisibilityDropAlert(
  userEmail: string,
  clientName: string,
  oldScore: number,
  newScore: number
) {
  const drop = oldScore - newScore

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: userEmail,
    subject: `⚠ ${clientName}: AI visibility dropped ${drop}%`,
    html: `
      <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #7C3AED; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 18px; margin: 0;">Citari Visibility Alert</h1>
        </div>
        <div style="background: white; border: 1px solid #E5E7EB; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #111827; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            <strong>${clientName}</strong>'s AI visibility score has dropped significantly.
          </p>
          <div style="display: flex; gap: 24px; margin: 24px 0;">
            <div style="text-align: center;">
              <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">Previous</p>
              <p style="color: #111827; font-size: 28px; font-weight: 700; margin: 0;">${oldScore}%</p>
            </div>
            <div style="text-align: center;">
              <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">→</p>
              <p style="color: #6B7280; font-size: 28px; font-weight: 700; margin: 0;">→</p>
            </div>
            <div style="text-align: center;">
              <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; margin: 0 0 4px;">Current</p>
              <p style="color: #DC2626; font-size: 28px; font-weight: 700; margin: 0;">${newScore}%</p>
            </div>
          </div>
          <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 16px 0 24px;">
            This is a drop of <strong style="color: #DC2626;">${drop} percentage points</strong>.
            Review competitor activity and consider creating new GEO content to recover visibility.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/overview"
             style="display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
            View Dashboard →
          </a>
        </div>
      </div>
    `,
  })
}

export async function sendWeeklyDigest(
  userEmail: string,
  clients: {
    name: string
    visibilityScore: number
    change: number
    gapsCount: number
  }[]
) {
  const clientRows = clients
    .map(
      (c) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #111827;">${c.name}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; font-weight: 600; color: #111827;">${c.visibilityScore}%</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: ${c.change >= 0 ? '#059669' : '#DC2626'}; font-weight: 600;">
          ${c.change >= 0 ? '↑' : '↓'} ${Math.abs(c.change)}%
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: ${c.gapsCount > 0 ? '#DC2626' : '#6B7280'};">${c.gapsCount}</td>
      </tr>`
    )
    .join('')

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: userEmail,
    subject: `Citari Weekly Digest — ${clients.length} client${clients.length !== 1 ? 's' : ''} tracked`,
    html: `
      <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #7C3AED; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; font-size: 18px; margin: 0;">Weekly AI Visibility Digest</h1>
        </div>
        <div style="background: white; border: 1px solid #E5E7EB; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="color: #6B7280; font-size: 14px; margin: 0 0 20px;">Here's how your clients performed this week across ChatGPT, Claude, and Gemini.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #F9FAFB;">
                <th style="padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 0.05em;">Client</th>
                <th style="padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 0.05em;">Score</th>
                <th style="padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 0.05em;">Change</th>
                <th style="padding: 10px 16px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6B7280; letter-spacing: 0.05em;">Gaps</th>
              </tr>
            </thead>
            <tbody>${clientRows}</tbody>
          </table>
          <div style="margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/overview"
               style="display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
              Open Citari →
            </a>
          </div>
        </div>
      </div>
    `,
  })
}
