import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { buildClientContext } from '@/lib/utils'

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ])

export const maxDuration = 60

export async function POST(request: Request) {
  try {
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

  console.log('Setup starting for client:', client.name, '| domain:', client.domain)
  console.log('Client data:', JSON.stringify(client))

  console.log('A - building context')
  const clientContext = buildClientContext(client)
  console.log('B - context built:', clientContext.slice(0, 100))

  const steps: string[] = []
  console.log('C - creating anthropic')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  console.log('D - anthropic created')

  // ── STEP 1: Discover competitors ──
  console.log('Starting Step 1: competitor discovery')
  let competitorNames: string[] = []
  try {
    const res = await withTimeout(anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: `Identify the top 5 direct competitors for this business. They must be in the same specialization AND serve the same geographic area. Return ONLY valid JSON: {"competitors":[{"name":"...","domain":"..."}]}`,
      messages: [{ role: 'user', content: `Business: ${clientContext}\nDomain: ${client.domain || 'N/A'}` }],
    }), 25000)

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
    console.error('STEP 1 failed:', e.message)
    steps.push(`Competitor discovery failed: ${e.message}`)
  }
  console.log('Step 1 complete:', competitorNames.length, 'competitors')

  // ── STEP 2: Generate tracking prompts ──
  console.log('Starting Step 2: prompts')
  try {
    const res = await withTimeout(anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 2048,
      system: `Generate 10 tracking prompts — these are questions that POTENTIAL CUSTOMERS would ask an AI model when looking for this type of business or service. Every prompt MUST be specific to this business's exact specialization and locations. Include the actual location names. Do NOT generate generic industry prompts. Return ONLY valid JSON: {"prompts":[{"text":"...","category":"awareness|evaluation|purchase"}]}`,
      messages: [{ role: 'user', content: `Business: ${clientContext}\nDomain: ${client.domain || 'N/A'}\nCompetitors: ${competitorNames.join(', ') || 'Unknown'}` }],
    }), 25000)

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
        await admin.from('prompts').insert(rows)
        steps.push(`Added ${rows.length} tracking prompts`)
      }
    }
  } catch (e: any) {
    console.error('STEP 2 failed:', e.message)
    steps.push(`Prompt generation failed: ${e.message}`)
  }
  console.log('Step 2 complete')

  // ── STEP 3: Generate buyer-intent keywords ──
  console.log('Starting Step 3: keywords')
  try {
    if (client.domain) {
      const compDomains = competitorNames.length > 0
        ? (await admin.from('competitors').select('domain').eq('client_id', client_id)).data?.map((c) => c.domain).filter(Boolean) as string[] || []
        : []

      const kwRes = await withTimeout(anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 1024,
        system: `Generate 8 keywords that a POTENTIAL CLIENT would type into Google when searching for this type of business. Focus exclusively on buyer-intent keywords.${client.location ? ` Include location-specific keywords for: ${client.location}.` : ''}\n\nDo NOT generate directory names, award sites, publication names, or industry association terms. Only real search queries from real potential clients.\n\nReturn ONLY valid JSON: {"keywords":["keyword1","keyword2",...]}`,
        messages: [{ role: 'user', content: `Business: ${clientContext}\nDomain: ${client.domain || 'N/A'}` }],
      }), 25000)

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
        const keywordRows = discoveredKws.map((kw) => ({
          client_id, keyword: kw, category: 'category' as const,
          monthly_volume: null, your_rank: null,
          top_competitor_name: null, top_competitor_rank: null,
          ai_visible: 'no' as const,
        }))
        await admin.from('keywords').insert(keywordRows)
        steps.push(`Added ${keywordRows.length} keywords`)
      }
    }
  } catch (e: any) {
    console.error('STEP 3 failed:', e.message)
    steps.push(`Keyword discovery failed: ${e.message}`)
  }
  console.log('Step 3 complete')

  console.log('Setup complete. Steps:', JSON.stringify(steps))

  return NextResponse.json({
    steps,
    success: steps.length > 0,
    competitors_found: competitorNames.length,
  })
  } catch (e: any) {
    console.error('Setup route TOP-LEVEL CRASH:', e)
    return NextResponse.json({ error: e.message || 'Setup failed' }, { status: 500 })
  }
}
