import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { testHubSpotConnection } from '@/lib/cms/hubspot'

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { access_token } = await request.json()
  if (!access_token) return NextResponse.json({ error: 'access_token required' }, { status: 400 })

  const works = await testHubSpotConnection(access_token)
  if (!works) return NextResponse.json({ error: 'Invalid HubSpot access token' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: settings } = await admin.from('user_settings').select('workspace_id').eq('user_id', user.id).single()
  if (!settings?.workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { data: existing } = await admin
    .from('cms_connections')
    .select('id')
    .eq('workspace_id', settings.workspace_id)
    .eq('platform', 'hubspot')
    .single()

  if (existing) {
    await admin.from('cms_connections').update({ access_token, is_active: true }).eq('id', existing.id)
    return NextResponse.json({ id: existing.id, status: 'updated' })
  }

  const { data: created, error } = await admin
    .from('cms_connections')
    .insert({
      workspace_id: settings.workspace_id,
      platform: 'hubspot',
      access_token,
      site_url: 'https://app.hubspot.com',
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: created.id, status: 'connected' })
}
