import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find content scheduled for publish that's due
  const now = new Date().toISOString()
  const { data: scheduled } = await supabase
    .from('geo_content')
    .select('id, client_id, title, content, published_url, cms_platform, scheduled_publish_at')
    .eq('status', 'draft')
    .not('scheduled_publish_at', 'is', null)
    .lte('scheduled_publish_at', now)

  if (!scheduled || scheduled.length === 0) {
    return NextResponse.json({ message: 'No content to publish', published: 0 })
  }

  let published = 0
  const errors: string[] = []

  for (const item of scheduled) {
    try {
      // For now: mark as published (CMS push will be added with integrations)
      // If cms_platform is 'manual', just update status
      await supabase
        .from('geo_content')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      published++

      // Send confirmation email to workspace owner
      try {
        const { data: client } = await supabase
          .from('clients')
          .select('workspace_id, name')
          .eq('id', item.client_id)
          .single()

        if (client?.workspace_id) {
          const { data: workspace } = await supabase
            .from('workspaces')
            .select('owner_id')
            .eq('id', client.workspace_id)
            .single()

          if (workspace?.owner_id) {
            const { data: userData } = await supabase.auth.admin.getUserById(workspace.owner_id)
            const email = userData?.user?.email

            if (email && process.env.RESEND_API_KEY) {
              const resend = new Resend(process.env.RESEND_API_KEY)
              await resend.emails.send({
                from: 'Citari <alerts@citari.app>',
                to: email,
                subject: `Content published: ${item.title}`,
                html: `
                  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
                    <p>Your scheduled content "<strong>${item.title}</strong>" for <strong>${client.name}</strong> has been published.</p>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/geo" style="color:#7C3AED;">View in Citari →</a>
                  </div>
                `,
              })
            }
          }
        }
      } catch {
        // Email failed — non-critical
      }
    } catch (e: any) {
      errors.push(`Failed to publish ${item.title}: ${e.message}`)
    }
  }

  return NextResponse.json({ published, errors: errors.length > 0 ? errors : undefined })
}
