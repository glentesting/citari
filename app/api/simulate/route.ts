import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { buildClientContext } from '@/lib/utils'

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

  const { client_id, target_score } = await request.json()
  if (!client_id || target_score == null) {
    return NextResponse.json({ error: 'client_id and target_score are required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch client
  const { data: client } = await adminSupabase
    .from('clients')
    .select('name, domain, industry, location, specialization, description')
    .eq('id', client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Fetch recent scan results
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: scans } = await adminSupabase
    .from('scan_results')
    .select('model, mentioned, mention_position, competitor_mentions, prompt_id')
    .eq('client_id', client_id)
    .gte('scanned_at', thirtyDaysAgo.toISOString())

  const results = scans || []
  const currentMentions = results.filter((r) => r.mentioned).length
  const currentScore = results.length > 0 ? Math.round((currentMentions / results.length) * 100) : 0

  // Fetch competitors
  const { data: competitors } = await adminSupabase
    .from('competitors')
    .select('name')
    .eq('client_id', client_id)

  const competitorNames = (competitors || []).map((c) => c.name)

  // Fetch prompts
  const { data: prompts } = await adminSupabase
    .from('prompts')
    .select('id, text, category')
    .eq('client_id', client_id)
    .eq('is_active', true)

  const promptMap = new Map((prompts || []).map((p) => [p.id, p]))

  // Find gap prompts (competitor mentioned, client not)
  const promptIds = [...new Set(results.map((r) => r.prompt_id))]
  const gapPrompts: string[] = []
  for (const pid of promptIds) {
    const pScans = results.filter((r) => r.prompt_id === pid)
    const clientMentioned = pScans.some((r) => r.mentioned)
    const compMentioned = pScans.some((r) => r.competitor_mentions && r.competitor_mentions.length > 0)
    if (!clientMentioned && compMentioned) {
      const p = promptMap.get(pid)
      if (p) gapPrompts.push(p.text)
    }
  }

  // Fetch GEO content stats
  const { count: geoCount } = await adminSupabase
    .from('geo_content')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client_id)

  const dataBrief = `
CLIENT: ${buildClientContext(client)}${client.domain ? ` (${client.domain})` : ''}
COMPETITORS: ${competitorNames.join(', ') || 'None'}

CURRENT VISIBILITY SCORE: ${currentScore}%
TARGET VISIBILITY SCORE: ${target_score}%
GAP TO CLOSE: ${target_score - currentScore} percentage points

TOTAL ACTIVE PROMPTS: ${(prompts || []).length}
TOTAL SCANS (30 days): ${results.length}

COMPETITOR GAP PROMPTS (${gapPrompts.length} prompts where competitors appear but ${client.name} does not):
${gapPrompts.slice(0, 15).map((p, i) => `${i + 1}. "${p}"`).join('\n')}

EXISTING GEO CONTENT: ${geoCount || 0} pieces created
`.trim()

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let text: string
  try {
    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 2048,
      system: `You are an AI visibility strategist. A client is currently at ${currentScore}% AI visibility and wants to reach ${target_score}%. Analyze their data and create a specific, actionable roadmap.

Return ONLY valid JSON in this exact format:
{
  "summary": "One-sentence summary of what it will take",
  "estimated_weeks": 8,
  "actions": [
    {
      "step": 1,
      "action": "Specific action to take",
      "detail": "Why this works and how to do it",
      "estimated_impact": "+5%",
      "estimated_weeks": 2,
      "content_topics": ["topic 1", "topic 2"]
    }
  ]
}

Be specific about content topics, which prompts to target, and which competitors to counter. Give 5-8 actions ordered by expected impact. Each action should have realistic impact estimates that sum to roughly the gap they need to close.`,
      messages: [{ role: 'user', content: `Create a visibility roadmap based on this data:\n\n${dataBrief}` }],
    })
    const block = response.content[0]
    text = block.type === 'text' ? block.text : ''
  } catch (e: any) {
    console.error('Simulation AI call failed:', e)
    return NextResponse.json({ error: 'AI generation failed — please try again' }, { status: 502 })
  }

  let parsed: any
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch (e) {
    console.error('Failed to parse simulation response:', e)
    return NextResponse.json({ error: 'Failed to parse simulation response' }, { status: 500 })
  }

  return NextResponse.json({
    currentScore,
    targetScore: target_score,
    ...parsed,
  })
}
