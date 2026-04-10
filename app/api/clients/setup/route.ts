import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { searchKeyword } from '@/lib/keywords/serper'
import { crawlCompetitorSitemap, fetchPageContent } from '@/lib/competitors/crawl'
import { buildClientContext } from '@/lib/utils'

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
    .select('name, domain, industry, location, specialization, description, target_clients, differentiators')
    .eq('id', client_id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const clientContext = buildClientContext(client)
  const steps: string[] = []
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // ── STEP 1: Discover competitors ──
  let competitorNames: string[] = []
  const competitorRows: { name: string; domain: string | null }[] = []
  try {
    const res = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: `Identify the top 5 direct competitors for this business. They must be in the same specialization AND serve the same geographic area. Return ONLY valid JSON: {"competitors":[{"name":"...","domain":"..."}]}`,
      messages: [{ role: 'user', content: `Business: ${clientContext}\nDomain: ${client.domain || 'N/A'}` }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed.competitors)) {
        for (const c of parsed.competitors.slice(0, 5)) {
          competitorRows.push({ name: c.name, domain: c.domain || null })
        }
        const rows = competitorRows.map((c) => ({ client_id, name: c.name, domain: c.domain }))
        await admin.from('competitors').insert(rows)
        competitorNames = competitorRows.map((r) => r.name)
        steps.push(`Added ${rows.length} competitors`)
      }
    }
  } catch (e: any) {
    steps.push(`Competitor discovery failed: ${e.message}`)
  }

  // ── STEP 2: Crawl competitor websites ──
  try {
    const BATCH_SIZE = 3
    for (const comp of competitorRows) {
      if (!comp.domain) continue
      const urls = await crawlCompetitorSitemap(comp.domain)
      if (urls.length === 0) {
        const homepage = await fetchPageContent(`https://${comp.domain}`)
        if (homepage) urls.push(homepage.url)
      }

      const pages = []
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(
          batch.map((url) => fetchPageContent(url).catch(() => null))
        )
        for (const content of results) {
          if (content) pages.push(content)
        }
      }

      if (pages.length > 0) {
        // Get competitor ID
        const { data: compRecord } = await admin.from('competitors')
          .select('id').eq('client_id', client_id).eq('name', comp.name).single()

        if (compRecord) {
          const contentRows = pages.map((page) => ({
            competitor_id: compRecord.id,
            url: page.url,
            title: page.title,
            excerpt: page.excerpt.slice(0, 2000),
            likely_cited: false,
            citation_prompt_ids: [] as string[],
          }))
          await admin.from('competitor_content').delete().eq('competitor_id', compRecord.id)
          await admin.from('competitor_content').insert(contentRows)
        }
      }
    }
    steps.push(`Crawled ${competitorRows.filter((c) => c.domain).length} competitor websites`)
  } catch (e: any) {
    steps.push(`Competitor crawl failed: ${e.message}`)
  }

  // ── STEP 3: Generate tracking prompts ──
  let promptIds: string[] = []
  try {
    const res = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 2048,
      system: `Generate 10 tracking prompts — these are questions that POTENTIAL CUSTOMERS would ask an AI model when looking for this type of business or service. Every prompt MUST be specific to this business's exact specialization and locations. Include the actual location names. Do NOT generate generic industry prompts. Return ONLY valid JSON: {"prompts":[{"text":"...","category":"awareness|evaluation|purchase"}]}`,
      messages: [{ role: 'user', content: `Business: ${clientContext}\nDomain: ${client.domain || 'N/A'}\nCompetitors: ${competitorNames.join(', ') || 'Unknown'}` }],
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

  // ── STEP 4: Generate buyer-intent keywords ──
  try {
    if (client.domain) {
      const compDomains = competitorRows.map((c) => c.domain).filter(Boolean) as string[]

      const kwRes = await anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 1024,
        system: `Generate 8 keywords that a POTENTIAL CLIENT would type into Google when searching for this type of business. Focus exclusively on buyer-intent keywords.${client.location ? ` Include location-specific keywords for: ${client.location}.` : ''}\n\nDo NOT generate directory names, award sites, publication names, or industry association terms. Only real search queries from real potential clients.\n\nReturn ONLY valid JSON: {"keywords":["keyword1","keyword2",...]}`,
        messages: [{ role: 'user', content: `Business: ${clientContext}\nDomain: ${client.domain || 'N/A'}` }],
      })

      const kwText = kwRes.content[0].type === 'text' ? kwRes.content[0].text : ''
      const kwMatch = kwText.match(/\{[\s\S]*\}/)
      let discoveredKws: string[] = []
      if (kwMatch) {
        const parsed = JSON.parse(kwMatch[0])
        if (Array.isArray(parsed.keywords)) {
          discoveredKws = parsed.keywords.slice(0, 8)
        }
      }

      if (discoveredKws.length > 0) {
        const keywordRows = []
        for (const kw of discoveredKws) {
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

  // ── STEP 5: Run competitive intelligence for each competitor ──
  try {
    const { data: comps } = await admin.from('competitors')
      .select('id, name, domain')
      .eq('client_id', client_id)

    for (const comp of (comps || [])) {
      try {
        // Get crawled content for this competitor
        const { data: content } = await admin.from('competitor_content')
          .select('title, excerpt')
          .eq('competitor_id', comp.id)
          .limit(10)

        const contentSummary = (content || [])
          .map((c) => `${c.title}: ${c.excerpt.slice(0, 300)}`)
          .join('\n\n')

        const intelRes = await anthropic.messages.create({
          model: MODELS.sonnet,
          max_tokens: 2048,
          system: `You are a senior competitive intelligence analyst. Your job is to explain exactly why a competitor is winning more customers than your client, and what to do about it. Be specific, direct, and ruthless. No fluff.

Return ONLY valid JSON:
{
  "why_winning": "string (3-4 sentences — the real reasons this competitor is getting more customers. Be specific. Reference their actual content and positioning)",
  "content_gaps": "string (bullet list of specific topics the competitor covers that the client does not. Each bullet = one actionable content opportunity)",
  "visibility_score": number 1-100,
  "intel_brief": "string (4-6 paragraphs. Written like a consultant report. Covers: who they are, why they're winning, where they show up, what the client needs to do. Specific, not generic)",
  "threat_level": "low | medium | high | critical"
}`,
          messages: [{
            role: 'user',
            content: `CLIENT PROFILE:\n${clientContext}\nDomain: ${client.domain || 'N/A'}\n\nCOMPETITOR: ${comp.name}\nDomain: ${comp.domain || 'N/A'}\n\nCOMPETITOR CONTENT:\n${contentSummary.slice(0, 4000) || 'No content crawled'}`,
          }],
        })

        const intelText = intelRes.content[0].type === 'text' ? intelRes.content[0].text : ''
        const intelMatch = intelText.match(/\{[\s\S]*\}/)
        if (intelMatch) {
          const intel = JSON.parse(intelMatch[0])
          await admin.from('competitors').update({
            intel_brief: intel.intel_brief || null,
            why_winning: intel.why_winning || null,
            content_gaps: intel.content_gaps || null,
            visibility_score: intel.visibility_score || null,
          }).eq('id', comp.id)
        }
      } catch (e: any) {
        console.error(`Intel analysis failed for ${comp.name}:`, e)
      }
    }
    steps.push(`Completed competitive intelligence analysis`)
  } catch (e: any) {
    steps.push(`Intelligence analysis failed: ${e.message}`)
  }

  return NextResponse.json({
    steps,
    success: steps.length > 0,
    competitors_found: competitorNames.length,
    prompts_created: promptIds.length,
  })
}
