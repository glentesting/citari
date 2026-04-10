import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateGeoContent } from '@/lib/ai/generate'
import { buildClientContext } from '@/lib/utils'

export const maxDuration = 60

export async function POST(request: Request) {
  const cookieStore = cookies()

  // Auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    client_id,
    target_prompt,
    content_type,
    tone = 'authoritative',
    word_count = 1200,
  } = body as {
    client_id: string
    target_prompt: string
    content_type: 'article' | 'comparison' | 'faq' | 'landing'
    tone?: string
    word_count?: number
  }

  if (!client_id || !target_prompt || !content_type) {
    return NextResponse.json(
      { error: 'client_id, target_prompt, and content_type are required' },
      { status: 400 }
    )
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch client info
  const { data: client } = await adminSupabase
    .from('clients')
    .select('name, domain, industry, location, specialization, description')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const clientContext = buildClientContext(client)

  // Fetch competitors
  const { data: competitors } = await adminSupabase
    .from('competitors')
    .select('name')
    .eq('client_id', client_id)

  const competitorNames = (competitors || []).map((c) => c.name)

  // Generate content
  let result: { title: string; content: string }
  try {
    result = await generateGeoContent({
      targetPrompt: target_prompt,
      contentType: content_type,
      tone,
      wordCount: word_count,
      clientName: client.name,
      clientDomain: client.domain || undefined,
      clientIndustry: clientContext,
      competitorNames,
    })
  } catch (e: any) {
    console.error('Content generation AI call failed:', e)
    return NextResponse.json({ error: 'AI generation failed — please try again' }, { status: 502 })
  }

  // Save to geo_content table
  const { data: saved, error: saveError } = await adminSupabase
    .from('geo_content')
    .insert({
      client_id,
      title: result.title,
      content: result.content,
      target_prompt,
      content_type,
      tone,
      word_count_target: word_count,
      status: 'draft',
    })
    .select()
    .single()

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({
    id: saved.id,
    title: result.title,
    content: result.content,
  })
}
