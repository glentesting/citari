import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createHubSpotBlogPost } from '@/lib/cms/hubspot'

export const maxDuration = 30

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

  const { content_id, connection_id } = await request.json()
  if (!content_id || !connection_id) return NextResponse.json({ error: 'content_id and connection_id required' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: content } = await admin.from('geo_content').select('title, content, target_prompt').eq('id', content_id).single()
  if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

  const { data: connection } = await admin.from('cms_connections').select('access_token, is_active').eq('id', connection_id).eq('platform', 'hubspot').single()
  if (!connection || !connection.is_active) return NextResponse.json({ error: 'HubSpot connection not found' }, { status: 404 })

  try {
    const slug = content.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const result = await createHubSpotBlogPost(
      { access_token: connection.access_token },
      { title: content.title, content: content.content || '', slug, metaDescription: content.target_prompt || '' }
    )

    await admin.from('geo_content').update({ cms_platform: 'hubspot', cms_post_id: result.post_id, cms_post_url: result.url }).eq('id', content_id)

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
