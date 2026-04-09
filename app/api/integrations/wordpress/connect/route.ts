import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { testWordPressConnection } from '@/lib/cms/wordpress'

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

  const { site_url, username, application_password, client_id } = await request.json()
  if (!site_url || !username || !application_password) {
    return NextResponse.json({ error: 'site_url, username, and application_password required' }, { status: 400 })
  }

  // Create base64 auth token
  const token = Buffer.from(`${username}:${application_password}`).toString('base64')
  const normalizedUrl = site_url.replace(/\/$/, '').replace(/^(?!https?:\/\/)/, 'https://')

  // Test connection
  const works = await testWordPressConnection({ site_url: normalizedUrl, access_token: token })
  if (!works) {
    return NextResponse.json({ error: 'Could not connect — check URL, username, and application password' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Get workspace_id
  const { data: settings } = await admin
    .from('user_settings')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!settings?.workspace_id) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  // Upsert connection
  const { data: existing } = await admin
    .from('cms_connections')
    .select('id')
    .eq('workspace_id', settings.workspace_id)
    .eq('platform', 'wordpress')
    .eq('site_url', normalizedUrl)
    .single()

  if (existing) {
    await admin
      .from('cms_connections')
      .update({ access_token: token, is_active: true, client_id: client_id || null })
      .eq('id', existing.id)

    return NextResponse.json({ id: existing.id, status: 'updated' })
  }

  const { data: created, error } = await admin
    .from('cms_connections')
    .insert({
      workspace_id: settings.workspace_id,
      client_id: client_id || null,
      platform: 'wordpress',
      access_token: token,
      site_url: normalizedUrl,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: created.id, status: 'connected' })
}
