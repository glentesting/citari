import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createWordPressDraft } from '@/lib/cms/wordpress'

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
  if (!content_id || !connection_id) {
    return NextResponse.json({ error: 'content_id and connection_id required' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Fetch content
  const { data: content } = await admin
    .from('geo_content')
    .select('title, content')
    .eq('id', content_id)
    .single()

  if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

  // Fetch connection
  const { data: connection } = await admin
    .from('cms_connections')
    .select('site_url, access_token, is_active')
    .eq('id', connection_id)
    .eq('platform', 'wordpress')
    .single()

  if (!connection || !connection.is_active) {
    return NextResponse.json({ error: 'WordPress connection not found or inactive' }, { status: 404 })
  }

  try {
    const result = await createWordPressDraft(
      { site_url: connection.site_url, access_token: connection.access_token },
      { title: content.title, content: content.content || '', status: 'draft' }
    )

    // Store the WordPress post ID
    await admin
      .from('geo_content')
      .update({
        cms_platform: 'wordpress',
        cms_post_id: result.post_id,
        cms_post_url: result.post_url,
      })
      .eq('id', content_id)

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
