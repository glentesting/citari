import { SupabaseClient } from '@supabase/supabase-js'
import { sendConsultantDropAlert } from './consultantAlerts'
import { sendDirectDropAlert, sendDirectClientNotification } from './directAlerts'

interface AlertContext {
  supabase: SupabaseClient
  workspaceId: string
  ownerId: string
  clientId: string
  clientName: string
  oldScore: number
  newScore: number
  gapCount: number
  topCompetitorAction?: string | null
}

/**
 * Route a visibility drop alert based on workspace mode.
 * Consultant mode: strategic alert to consultant + optional client notification.
 * Direct mode: plain-English alert to business owner.
 */
export async function routeVisibilityAlert(ctx: AlertContext) {
  const { supabase, workspaceId, ownerId, clientId, clientName, oldScore, newScore, gapCount, topCompetitorAction } = ctx

  // Get workspace mode
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('mode, consultant_name, consultant_email')
    .eq('id', workspaceId)
    .single()

  const mode = workspace?.mode || 'direct'

  // Get owner email
  const { data: ownerData } = await supabase.auth.admin.getUserById(ownerId)
  const ownerEmail = ownerData?.user?.email

  if (!ownerEmail) return

  try {
    if (mode === 'consultant') {
      // Send strategic alert to consultant
      const consultantEmail = workspace?.consultant_email || ownerEmail
      const consultantName = workspace?.consultant_name || 'there'
      await sendConsultantDropAlert(
        consultantEmail,
        consultantName,
        clientName,
        oldScore,
        newScore,
        topCompetitorAction || null,
        gapCount
      )

      // Also notify the client if configured
      const { data: client } = await supabase
        .from('clients')
        .select('notify_client_email, client_notification_level')
        .eq('id', clientId)
        .single()

      if (client?.notify_client_email && client?.client_notification_level !== 'none') {
        // Get portal URL if exists
        const { data: portal } = await supabase
          .from('client_portal_access')
          .select('portal_slug')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .single()

        const portalUrl = portal?.portal_slug
          ? `${process.env.NEXT_PUBLIC_APP_URL}/${portal.portal_slug}`
          : null

        await sendDirectClientNotification(
          client.notify_client_email,
          clientName,
          newScore,
          portalUrl,
          (client.client_notification_level as 'summary' | 'full') || 'summary'
        )
      }
    } else {
      // Direct mode — plain English to owner
      await sendDirectDropAlert(ownerEmail, clientName, oldScore, newScore)
    }
  } catch (e) {
    console.error('Alert routing failed:', e)
  }
}
