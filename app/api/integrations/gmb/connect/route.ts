import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getGMBLocations } from '@/lib/gmb/client'

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

  // Test the token by fetching locations
  const locations = await getGMBLocations(access_token)
  if (locations.length === 0) return NextResponse.json({ error: 'Invalid token or no GMB locations found' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: settings } = await admin.from('user_settings').select('workspace_id').eq('user_id', user.id).single()
  if (!settings?.workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { data: existing } = await admin
    .from('cms_connections')
    .select('id')
    .eq('workspace_id', settings.workspace_id)
    .eq('platform', 'gmb')
    .single()

  if (existing) {
    await admin.from('cms_connections').update({ access_token, is_active: true }).eq('id', existing.id)
    return NextResponse.json({ id: existing.id, status: 'updated' })
  }

  const { data: created, error } = await admin
    .from('cms_connections')
    .insert({
      workspace_id: settings.workspace_id,
      platform: 'gmb',
      access_token,
      site_url: 'https://business.google.com',
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: created.id, status: 'connected' })
}
