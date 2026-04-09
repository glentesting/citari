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

  const { content_id, scheduled_publish_at, cms_platform } = await request.json()
  if (!content_id || !scheduled_publish_at) {
    return NextResponse.json({ error: 'content_id and scheduled_publish_at required' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: content } = await admin
    .from('geo_content')
    .select('id, status')
    .eq('id', content_id)
    .single()

  if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 })

  const { error: updateError } = await admin
    .from('geo_content')
    .update({
      scheduled_publish_at,
      cms_platform: cms_platform || 'manual',
    })
    .eq('id', content_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ scheduled: true })
}
