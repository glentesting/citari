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

  const { client_id, date_range_start, date_range_end } = await request.json()
  if (!client_id) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch client
  const { data: client } = await adminSupabase
    .from('clients')
    .select('name, domain, industry')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Date range defaults to last 30 days
  const endDate = date_range_end ? new Date(date_range_end) : new Date()
  const startDate = date_range_start
    ? new Date(date_range_start)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

  const prevStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))

  // Fetch current period scan results
  const { data: currentScans, count: scanCount } = await adminSupabase
    .from('scan_results')
    .select('model, mentioned, mention_position, competitor_mentions, prompt_id', { count: 'exact' })
    .eq('client_id', client_id)
    .gte('scanned_at', startDate.toISOString())
    .lte('scanned_at', endDate.toISOString())

  if (!currentScans || currentScans.length === 0) {
    return NextResponse.json({ error: 'No scan data yet. Run a scan first from the AI Visibility page to generate a narrative.' }, { status: 400 })
  }

  // Fetch previous period for comparison
  const { data: prevScans } = await adminSupabase
    .from('scan_results')
    .select('model, mentioned, competitor_mentions')
    .eq('client_id', client_id)
    .gte('scanned_at', prevStartDate.toISOString())
    .lt('scanned_at', startDate.toISOString())

  const current = currentScans || []
  const previous = prevScans || []

  // Compute metrics
  const currentMentions = current.filter((r) => r.mentioned).length
  const currentRate = current.length > 0 ? Math.round((currentMentions / current.length) * 100) : 0
  const prevMentions = previous.filter((r) => r.mentioned).length
  const prevRate = previous.length > 0 ? Math.round((prevMentions / previous.length) * 100) : 0
  const rateDelta = currentRate - prevRate

  // Per-platform
  const models = ['chatgpt', 'claude', 'gemini'] as const
  const platformStats = models.map((m) => {
    const mCurrent = current.filter((r) => r.model === m)
    const mPrev = previous.filter((r) => r.model === m)
    const cRate = mCurrent.length > 0 ? Math.round((mCurrent.filter((r) => r.mentioned).length / mCurrent.length) * 100) : 0
    const pRate = mPrev.length > 0 ? Math.round((mPrev.filter((r) => r.mentioned).length / mPrev.length) * 100) : 0
    return { model: m, currentRate: cRate, previousRate: pRate, delta: cRate - pRate }
  })

  // Competitor gaps
  const competitorMentionCounts = new Map<string, number>()
  for (const r of current) {
    if (r.competitor_mentions) {
      for (const c of r.competitor_mentions) {
        competitorMentionCounts.set(c, (competitorMentionCounts.get(c) || 0) + 1)
      }
    }
  }
  const topCompetitors = Array.from(competitorMentionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, mentions: count, rate: current.length > 0 ? Math.round((count / current.length) * 100) : 0 }))

  // Avg mention position
  const positions = current
    .filter((r) => r.mention_position != null)
    .map((r) => r.mention_position as number)
  const avgPosition = positions.length > 0
    ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
    : null

  // GEO content published in period
  const { data: geoContent } = await adminSupabase
    .from('geo_content')
    .select('title, status, cited_by_gpt, cited_by_claude, cited_by_gemini')
    .eq('client_id', client_id)
    .gte('created_at', startDate.toISOString())

  const geo = geoContent || []
  const publishedGeo = geo.filter((g) => g.status === 'published')
  const citedGeo = geo.filter((g) => g.cited_by_gpt || g.cited_by_claude || g.cited_by_gemini)

  // Build the data brief for Claude
  const dataBrief = `
CLIENT: ${client.name}${client.domain ? ` (${client.domain})` : ''}
INDUSTRY: ${client.industry || 'Not specified'}
PERIOD: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}

VISIBILITY SCORE: ${currentRate}% (${rateDelta >= 0 ? '+' : ''}${rateDelta}% vs previous period of ${prevRate}%)
TOTAL SCANS: ${current.length} results across ${models.length} AI models

PER-PLATFORM:
${platformStats.map((p) => `- ${p.model}: ${p.currentRate}% (${p.delta >= 0 ? '+' : ''}${p.delta}% vs prior)`).join('\n')}

AVG MENTION POSITION: ${avgPosition !== null ? `#${avgPosition}` : 'No data'}

TOP COMPETITORS BY AI MENTIONS:
${topCompetitors.length > 0 ? topCompetitors.map((c) => `- ${c.name}: ${c.rate}% mention rate (${c.mentions} mentions)`).join('\n') : '- No competitor data'}

COMPETITOR GAPS: ${new Set(current.filter((r) => !r.mentioned && r.competitor_mentions && r.competitor_mentions.length > 0).map((r) => r.prompt_id)).size} prompts where competitors appear but ${client.name} does not

GEO CONTENT: ${geo.length} pieces created, ${publishedGeo.length} published, ${citedGeo.length} cited by AI
${citedGeo.length > 0 ? `Cited content: ${citedGeo.map((g) => g.title).join(', ')}` : ''}
`.trim()

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 2048,
    system: `You are a senior SEO and AI visibility strategist writing a monthly intelligence briefing for a client. Write in plain English, no jargon. Lead with the most important finding. Be specific about which competitors are winning and on which prompts. Give 3 clear recommended actions ranked by expected impact. Tone: direct, confident, consultant-quality.

Write exactly 400 words. Format with clear sections using markdown headers (##). Do not include a title — start directly with the key finding.`,
    messages: [{ role: 'user', content: `Write a monthly AI visibility narrative for this client based on the following data:\n\n${dataBrief}` }],
  })

  const block = response.content[0]
  const narrative = block.type === 'text' ? block.text : ''

  return NextResponse.json({ narrative, metrics: { currentRate, prevRate, rateDelta, avgPosition } })
}
