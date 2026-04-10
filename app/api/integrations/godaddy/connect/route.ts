import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

  const { api_key, api_secret } = await request.json()
  if (!api_key || !api_secret) return NextResponse.json({ error: 'API key and secret required' }, { status: 400 })

  // Test connection
  try {
    const res = await fetch('https://api.godaddy.com/v1/domains?limit=1', {
      headers: { Authorization: `sso-key ${api_key}:${api_secret}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return NextResponse.json({ error: 'Invalid GoDaddy credentials' }, { status: 400 })
  } catch (e) {
    console.error('Failed to connect to GoDaddy API:', e)
    return NextResponse.json({ error: 'Could not connect to GoDaddy API' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: settings } = await admin.from('user_settings').select('workspace_id').eq('user_id', user.id).single()
  if (!settings?.workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { error } = await admin.from('cms_connections').insert({
    workspace_id: settings.workspace_id,
    platform: 'godaddy' as any,
    access_token: `${api_key}:${api_secret}`,
    site_url: 'https://godaddy.com',
    is_active: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'connected' })
}
