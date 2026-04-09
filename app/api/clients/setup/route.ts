import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { discoverKeywords, searchKeyword } from '@/lib/keywords/serper'
import { scanPrompt } from '@/lib/ai/scan'

export const maxDuration = 120

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

  const { data: client } = await admin
    .from('clients')
    .select('name, domain, industry')
    .eq('id', client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const steps: string[] = []

  // ── STEP 1: Discover competitors ──
  let competitorNames: string[] = []
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1024,
      system: `Identify the top 5 competitors for this business. Return ONLY valid JSON: {"competitors":[{"name":"...","domain":"..."}]}`,
      messages: [{ role: 'user', content: `Company: ${client.name}\nDomain: ${client.domain || 'N/A'}\nIndustry: ${client.industry || 'N/A'}` }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed.competitors)) {
        const rows = parsed.competitors.slice(0, 5).map((c: any) => ({
          client_id,
          name: c.name,
          domain: c.domain || null,
        }))
        await admin.from('competitors').insert(rows)
        competitorNames = rows.map((r: any) => r.name)
        steps.push(`Added ${rows.length} competitors`)
      }
    }
  } catch (e: any) {
    steps.push(`Competitor discovery failed: ${e.message}`)
  }

  // ── STEP 2: Generate and add tracking prompts ──
  let promptIds: string[] = []
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2048,
      system: `Generate 10 important tracking prompts for this business. These are questions buyers ask AI models. Return ONLY valid JSON: {"prompts":[{"text":"...","category":"awareness|evaluation|purchase"}]}`,
      messages: [{ role: 'user', content: `Company: ${client.name}\nIndustry: ${client.industry || 'N/A'}\nCompetitors: ${competitorNames.join(', ') || 'Unknown'}` }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed.prompts)) {
        const rows = parsed.prompts.slice(0, 10).map((p: any) => ({
          client_id,
          text: p.text,
          category: ['awareness', 'evaluation', 'purchase'].includes(p.category) ? p.category : 'awareness',
          is_active: true,
        }))
        const { data: inserted } = await admin.from('prompts').insert(rows).select('id')
        promptIds = (inserted || []).map((r) => r.id)
        steps.push(`Added ${rows.length} tracking prompts`)
      }
    }
  } catch (e: any) {
    steps.push(`Prompt generation failed: ${e.message}`)
  }

  // ── STEP 3: Discover and save keywords ──
  try {
    if (client.domain) {
      const competitorDomains = (await admin.from('competitors').select('domain').eq('client_id', client_id)).data || []
      const compDomains = competitorDomains.map((c) => c.domain).filter(Boolean) as string[]

      const discoveredKws = await discoverKeywords(client.domain, client.industry)

      if (discoveredKws.length > 0) {
        const keywordRows = []
        for (const kw of discoveredKws.slice(0, 10)) {
          const result = await searchKeyword(kw, client.domain, compDomains)
          keywordRows.push({
            client_id,
            keyword: kw,
            category: 'category' as const,
            monthly_volume: result.monthlyVolume,
            your_rank: result.position,
            top_competitor_name: result.topCompetitorName,
            top_competitor_rank: result.topCompetitorRank,
            ai_visible: 'no' as const,
          })
        }
        await admin.from('keywords').insert(keywordRows)
        steps.push(`Added ${keywordRows.length} keywords`)
      }
    }
  } catch (e: any) {
    steps.push(`Keyword discovery failed: ${e.message}`)
  }

  // ── STEP 4: Run first AI scan ──
  try {
    const { data: prompts } = await admin
      .from('prompts')
      .select('id, text')
      .eq('client_id', client_id)
      .eq('is_active', true)
      .limit(5) // scan first 5 to keep it fast

    if (prompts && prompts.length > 0) {
      const allResults: any[] = []
      for (const prompt of prompts) {
        const results = await scanPrompt(prompt.text, client.name, competitorNames)
        for (const r of results) {
          allResults.push({
            prompt_id: prompt.id,
            client_id,
            model: r.model,
            mentioned: r.mentioned,
            mention_position: r.mention_position,
            sentiment: r.sentiment,
            response_excerpt: r.response_excerpt,
            competitor_mentions: r.competitor_mentions,
          })
        }
      }
      if (allResults.length > 0) {
        await admin.from('scan_results').insert(allResults)
        steps.push(`Scanned ${prompts.length} prompts (${allResults.filter((r) => r.mentioned).length} mentions)`)
      }
    }
  } catch (e: any) {
    steps.push(`Initial scan failed: ${e.message}`)
  }

  return NextResponse.json({ steps })
}
