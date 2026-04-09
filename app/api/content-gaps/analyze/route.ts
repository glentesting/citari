import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

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

  const { client_id, competitor_id } = await request.json()
  if (!client_id || !competitor_id) return NextResponse.json({ error: 'client_id and competitor_id required' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: client } = await admin.from('clients').select('name, domain, industry').eq('id', client_id).single()
  const { data: competitor } = await admin.from('competitors').select('name, domain').eq('id', competitor_id).single()
  if (!client || !competitor) return NextResponse.json({ error: 'Client or competitor not found' }, { status: 404 })

  // Fetch competitor content
  const { data: compContent } = await admin
    .from('competitor_content')
    .select('title, url, excerpt')
    .eq('competitor_id', competitor_id)
    .limit(20)

  // Fetch client's GEO content
  const { data: clientContent } = await admin
    .from('geo_content')
    .select('title, target_prompt')
    .eq('client_id', client_id)
    .limit(20)

  const compTopics = (compContent || []).map((c) => `- ${c.title}: ${c.url}`).join('\n')
  const clientTopics = (clientContent || []).map((c) => `- ${c.title} (targeting: ${c.target_prompt})`).join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `You are a content strategist. Analyze the competitor's content vs the client's content and identify gaps — topics the competitor covers that the client doesn't.

Return ONLY valid JSON:
{"gaps":[{"topic":"...","competitor_url":"...","gap_score":1-10,"estimated_impact":"high|medium|low","reasoning":"..."}]}

gap_score: 10 = critical gap, 1 = minor. Focus on gaps that would affect AI visibility.`,
    messages: [{
      role: 'user',
      content: `Client: ${client.name} (${client.industry || 'general'})
Client's existing content:
${clientTopics || 'No content yet'}

Competitor: ${competitor.name} (${competitor.domain || ''})
Competitor's content:
${compTopics || 'No content crawled'}

Identify the top 10 content gaps.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let parsed: any
  try {
    const match = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match ? match[0] : text)
  } catch {
    return NextResponse.json({ error: 'Failed to parse analysis' }, { status: 500 })
  }

  // Store gaps
  const gaps = parsed.gaps || []
  if (gaps.length > 0) {
    // Delete old gaps for this competitor
    await admin.from('content_gaps').delete().eq('client_id', client_id).eq('competitor_id', competitor_id)

    const rows = gaps.slice(0, 10).map((g: any) => ({
      client_id,
      competitor_id,
      topic: g.topic,
      competitor_url: g.competitor_url || null,
      gap_score: g.gap_score || 5,
      estimated_impact: g.estimated_impact || 'medium',
      status: 'open',
    }))
    await admin.from('content_gaps').insert(rows)
  }

  return NextResponse.json({ gaps: gaps.length })
}
