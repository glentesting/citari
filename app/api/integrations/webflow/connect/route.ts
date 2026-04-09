import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { testWebflowConnection, getWebflowSites } from '@/lib/cms/webflow'

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

  const { access_token, site_id } = await request.json()
  if (!access_token) return NextResponse.json({ error: 'access_token required' }, { status: 400 })

  const works = await testWebflowConnection(access_token)
  if (!works) return NextResponse.json({ error: 'Invalid Webflow token' }, { status: 400 })

  const sites = await getWebflowSites(access_token)

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: settings } = await admin.from('user_settings').select('workspace_id').eq('user_id', user.id).single()
  if (!settings?.workspace_id) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { data: created, error } = await admin
    .from('cms_connections')
    .insert({
      workspace_id: settings.workspace_id,
      platform: 'webflow',
      access_token,
      site_id: site_id || (sites.length > 0 ? sites[0].id : null),
      site_url: 'https://webflow.com',
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: created.id, sites })
}
