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

    // Check if setup already ran (competitors exist)
    const { data: existingComps } = await admin.from('competitors').select('id').eq('client_id', client_id).limit(1)
    if (existingComps && existingComps.length > 0) {
      return NextResponse.json({ steps: ['Already set up'], success: true, competitors_found: existingComps.length })
    }

    const { data: client } = await admin
      .from('clients')
      .select('name, domain, industry, location, specialization, description, target_clients, differentiators')
      .eq('id', client_id)
      .single()

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // If profile is empty, run domain analysis first
    if (!client.specialization && !client.description && client.domain) {
      console.log('Empty profile detected — running domain analysis for:', client.domain)
      try {
        const { fetchWithTimeout } = await import('@/lib/utils')
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://citari.vercel.app'
        const analyzeRes = await fetchWithTimeout(`${baseUrl}/api/clients/analyze-domain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: client.domain }),
          timeoutMs: 15000,
        })
        if (analyzeRes.ok) {
          const profile = await analyzeRes.json()
          const updateData: Record<string, string | null> = {}
          if (profile.industry) updateData.industry = profile.industry
          if (profile.specialization) updateData.specialization = profile.specialization
          if (profile.location) updateData.location = profile.location
          if (profile.description) updateData.description = profile.description
          if (profile.target_clients) updateData.target_clients = profile.target_clients
          if (profile.differentiators) updateData.differentiators = profile.differentiators

          if (Object.keys(updateData).length > 0) {
            await admin.from('clients').update(updateData).eq('id', client_id)
            Object.assign(client, updateData)
            console.log('Profile auto-filled:', JSON.stringify(updateData))
          }
        }
      } catch (e: any) {
        console.error('Domain analysis in setup failed:', e.message)
      }
    }

    console.log('Setup running for:', client.name, '| specialization:', client.specialization)
    const clientContext = buildClientContext(client)
    const steps: string[] = []
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // ── STEP 1: Discover competitors ──
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
      console.error('Step 1 failed:', e.message)
      steps.push(`Competitor discovery failed: ${e.message}`)
    }

    // ── STEP 2: Generate tracking prompts ──
    try {
      const res = await withTimeout(anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 2048,
        system: `Generate 10 tracking prompts — questions that POTENTIAL CUSTOMERS would ask an AI model when looking for this type of business. Every prompt MUST be specific to this business's exact specialization and locations. Return ONLY valid JSON: {"prompts":[{"text":"...","category":"awareness|evaluation|purchase"}]}`,
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
      console.error('Step 2 failed:', e.message)
      steps.push(`Prompt generation failed: ${e.message}`)
    }

    // ── STEP 3: Generate buyer-intent keywords ──
    try {
      if (client.domain) {
        const kwRes = await withTimeout(anthropic.messages.create({
          model: MODELS.sonnet,
          max_tokens: 1024,
          system: `Generate 8 buyer-intent keywords for this business.${client.location ? ` Include keywords for: ${client.location}.` : ''} Do NOT generate directory names or award sites. Return ONLY valid JSON: {"keywords":["keyword1","keyword2",...]}`,
          messages: [{ role: 'user', content: `Business: ${clientContext}\nDomain: ${client.domain}` }],
        }), 25000)

        const kwText = kwRes.content[0].type === 'text' ? kwRes.content[0].text : ''
        const kwMatch = kwText.match(/\{[\s\S]*\}/)
        if (kwMatch) {
          const parsed = JSON.parse(kwMatch[0])
          if (Array.isArray(parsed.keywords)) {
            const keywordRows = parsed.keywords.slice(0, 8).map((kw: string) => ({
              client_id, keyword: kw, category: 'category' as const,
              monthly_volume: null, your_rank: null,
              top_competitor_name: null, top_competitor_rank: null,
              ai_visible: 'no' as const,
            }))
            await admin.from('keywords').insert(keywordRows)
            steps.push(`Added ${keywordRows.length} keywords`)
          }
        }
      }
    } catch (e: any) {
      console.error('Step 3 failed:', e.message)
      steps.push(`Keyword discovery failed: ${e.message}`)
    }

    console.log('Setup done:', JSON.stringify(steps))
    return NextResponse.json({ steps, success: true, competitors_found: competitorNames.length })
  } catch (e: any) {
    console.error('Setup crashed:', e)
    return NextResponse.json({ error: e.message || 'Setup failed' }, { status: 500 })
  }
}
