import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { scanPrompt } from '@/lib/ai/scan'
import { sendVisibilityDropAlert } from '@/lib/email/alerts'

export const maxDuration = 300 // 5 minute timeout for Vercel

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch all workspaces with their owners
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, owner_id')

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json({ message: 'No workspaces found' })
  }

  let totalScanned = 0
  let totalResults = 0
  const errors: string[] = []

  for (const workspace of workspaces) {
    // Fetch clients for this workspace
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, domain')
      .eq('workspace_id', workspace.id)

    if (!clients || clients.length === 0) continue

    // Fetch user settings for alert preferences
    const { data: settings } = await supabase
      .from('user_settings')
      .select('alert_on_drop, user_id')
      .eq('workspace_id', workspace.id)
      .single()

    // Fetch user email for alerts
    let userEmail: string | null = null
    if (settings?.alert_on_drop) {
      const { data: userData } = await supabase.auth.admin.getUserById(workspace.owner_id)
      userEmail = userData?.user?.email || null
    }

    for (const client of clients) {
      try {
        // Fetch active prompts
        const { data: prompts } = await supabase
          .from('prompts')
          .select('id, text')
          .eq('client_id', client.id)
          .eq('is_active', true)

        if (!prompts || prompts.length === 0) continue

        // Fetch competitors
        const { data: competitors } = await supabase
          .from('competitors')
          .select('name')
          .eq('client_id', client.id)

        const competitorNames = (competitors || []).map((c) => c.name)

        // Calculate previous visibility score (last 7 days before today)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const { data: prevScans } = await supabase
          .from('scan_results')
          .select('mentioned')
          .eq('client_id', client.id)
          .gte('scanned_at', sevenDaysAgo.toISOString())

        const prevMentions = (prevScans || []).filter((s) => s.mentioned).length
        const prevTotal = (prevScans || []).length
        const prevScore = prevTotal > 0 ? Math.round((prevMentions / prevTotal) * 100) : -1

        // Scan each prompt
        const allResults: any[] = []

        for (const prompt of prompts) {
          const results = await scanPrompt(prompt.text, client.name, competitorNames)

          for (const result of results) {
            allResults.push({
              prompt_id: prompt.id,
              client_id: client.id,
              model: result.model,
              mentioned: result.mentioned,
              mention_position: result.mention_position,
              sentiment: result.sentiment,
              response_excerpt: result.response_excerpt,
              competitor_mentions: result.competitor_mentions,
            })
          }

          totalScanned++
        }

        // Insert results
        if (allResults.length > 0) {
          const { error: insertError } = await supabase
            .from('scan_results')
            .insert(allResults)

          if (insertError) {
            errors.push(`Insert error for ${client.name}: ${insertError.message}`)
          } else {
            totalResults += allResults.length
          }
        }

        // Check for visibility drop and send alert
        if (settings?.alert_on_drop && userEmail && prevScore >= 0) {
          const newMentions = allResults.filter((r) => r.mentioned).length
          const newScore = allResults.length > 0
            ? Math.round((newMentions / allResults.length) * 100)
            : 0

          if (prevScore - newScore >= 5) {
            try {
              await sendVisibilityDropAlert(userEmail, client.name, prevScore, newScore)
            } catch (emailErr: any) {
              errors.push(`Email error for ${client.name}: ${emailErr.message}`)
            }
          }
        }
      } catch (err: any) {
        errors.push(`Scan error for ${client.name}: ${err.message}`)
      }
    }
  }

  return NextResponse.json({
    message: 'Daily scan complete',
    prompts_scanned: totalScanned,
    results_stored: totalResults,
    errors: errors.length > 0 ? errors : undefined,
  })
}
