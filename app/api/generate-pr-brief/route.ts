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

  const { client_id } = await request.json()
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: client } = await admin.from('clients').select('name, domain, industry, location, specialization, description, target_clients, differentiators').eq('id', client_id).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Gather citation sources from scan results
  const { data: scans } = await admin
    .from('scan_results')
    .select('citation_sources, citation_source_types, competitor_mentions')
    .eq('client_id', client_id)
    .gte('scanned_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const results = scans || []
  if (results.length === 0) {
    return NextResponse.json({ error: 'No scan data yet. Run a scan first from the AI Visibility page.' }, { status: 400 })
  }
  const publicationCounts = new Map<string, number>()
  for (const r of results) {
    const sources = r.citation_sources || []
    const types = r.citation_source_types || []
    for (let i = 0; i < sources.length; i++) {
      if (types[i] === 'press' || types[i] === 'academic') {
        publicationCounts.set(sources[i], (publicationCounts.get(sources[i]) || 0) + 1)
      }
    }
  }

  const topPublications = Array.from(publicationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 3000,
    system: `You are a PR strategist. Generate a PR brief for getting a company featured in publications that AI models cite. Return valid JSON:
{
  "summary": "One paragraph overview of the PR opportunity",
  "target_publications": [{"name": "...", "why": "...", "pitch_angle": "..."}],
  "press_release_draft": "A 300-word press release draft",
  "pitch_email": "A short pitch email template"
}`,
    messages: [{
      role: 'user',
      content: `Company: ${client.name} (${client.domain || ''})
Industry: ${client.industry || 'general'}

Publications that AI models cite for competitors in this category:
${topPublications.length > 0
  ? topPublications.map(([pub, count]) => `- ${pub} (cited ${count}x)`).join('\n')
  : 'No publication data yet — suggest relevant industry publications'}

Generate a PR brief to get ${client.name} covered by these publications.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let parsed: any
  try {
    const match = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match ? match[0] : text)
  } catch (e) {
    console.error('Failed to parse PR brief AI response:', e)
    return NextResponse.json({ error: 'Failed to parse PR brief' }, { status: 500 })
  }

  // Store PR opportunities
  if (parsed.target_publications) {
    const rows = parsed.target_publications.slice(0, 10).map((p: any) => ({
      client_id,
      publication: p.name,
      topic: p.pitch_angle,
      ai_citation_count: publicationCounts.get(p.name) || 0,
      status: 'identified',
    }))
    await admin.from('pr_opportunities').insert(rows)
  }

  return NextResponse.json(parsed)
}
