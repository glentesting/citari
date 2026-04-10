import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'

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

  const { data: client } = await admin.from('clients').select('name, domain, industry, location, specialization, description, target_clients, differentiators').eq('id', client_id).single()
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

  // Pull scan data: prompts where this competitor wins and client doesn't
  const { data: scans } = await admin.from('scan_results')
    .select('prompt_id, mentioned, competitor_mentions')
    .eq('client_id', client_id)
    .order('scanned_at', { ascending: false })
    .limit(200)

  const { data: prompts } = await admin.from('prompts')
    .select('id, text').eq('client_id', client_id)

  const promptMap = new Map((prompts || []).map((p) => [p.id, p.text]))

  const competitorWinPrompts = (scans || [])
    .filter((s: any) => s.competitor_mentions?.includes(competitor.name) && !s.mentioned)
    .map((s: any) => promptMap.get(s.prompt_id))
    .filter(Boolean)
  const uniqueWinPrompts = [...new Set(competitorWinPrompts)].slice(0, 10)

  const scanInsight = uniqueWinPrompts.length > 0
    ? `\nPROMPTS WHERE COMPETITOR WINS (competitor mentioned, client absent):\n${uniqueWinPrompts.map((p) => `- "${p}"`).join('\n')}\nThese are the HIGHEST PRIORITY gaps — content targeting these prompts should be prioritized.`
    : ''

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: MODELS.haiku,
    max_tokens: 2048,
    system: `You are a content strategist. Analyze the competitor's content vs the client's content and identify gaps. Prioritize gaps where the competitor is winning AI prompts that the client is losing.

Return ONLY valid JSON:
{"gaps":[{"topic":"...","competitor_url":"...","gap_score":1-10,"estimated_impact":"high|medium|low","prompt_count":N,"reasoning":"..."}]}

gap_score: 10 = critical gap the client is actively losing on, 1 = minor. prompt_count = number of active prompts this gap affects.`,
    messages: [{
      role: 'user',
      content: `Client: ${client.name} (${client.industry || 'general'})
Client's existing content:
${clientTopics || 'No content yet'}

Competitor: ${competitor.name} (${competitor.domain || ''})
Competitor's content:
${compTopics || 'No content crawled'}
${scanInsight}

Identify the top 10 content gaps, prioritizing those that affect active AI prompts.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let parsed: any
  try {
    const match = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match ? match[0] : text)
  } catch (e) {
    console.error('Failed to parse content gap analysis response:', e)
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
