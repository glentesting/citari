import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '@/lib/ai/models'
import { fetchPageContent } from '@/lib/competitors/crawl'
import { buildClientContext } from '@/lib/utils'

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ])

export const maxDuration = 120

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

    const { data: client } = await admin.from('clients')
      .select('name, domain, industry, location, specialization, description, target_clients, differentiators')
      .eq('id', client_id)
      .single()

    if (!client || !client.domain) {
      return NextResponse.json({ error: 'Client not found or no domain' }, { status: 404 })
    }

    // Fetch tracked prompts
    const { data: prompts } = await admin.from('prompts')
      .select('id, text')
      .eq('client_id', client_id)
      .eq('is_active', true)

    if (!prompts || prompts.length === 0) {
      return NextResponse.json({ error: 'No active prompts to audit against' }, { status: 400 })
    }

    // Crawl client's key pages
    const pagePaths = ['', '/about', '/services', '/practice-areas', '/what-we-do', '/faq', '/blog']
    const base = `https://${client.domain.replace(/^www\./, '')}`
    const wwwBase = `https://www.${client.domain.replace(/^www\./, '')}`

    const crawlResults = await Promise.all(
      pagePaths.map(async (path) => {
        const page = await fetchPageContent(`${base}${path}`).catch(() => null)
        if (page) return page
        return fetchPageContent(`${wwwBase}${path}`).catch(() => null)
      })
    )

    const pages = crawlResults.filter(Boolean) as { url: string; title: string; excerpt: string }[]

    if (pages.length === 0) {
      return NextResponse.json({ error: `Could not crawl ${client.domain}` }, { status: 404 })
    }

    const websiteContent = pages
      .map((p) => `PAGE: ${p.title} (${p.url})\n${p.excerpt.slice(0, 600)}`)
      .join('\n\n')

    // Audit each prompt against website content (batch 5 at a time to Claude)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const clientContext = buildClientContext(client)

    const BATCH = 5
    const auditResults: any[] = []

    for (let i = 0; i < prompts.length; i += BATCH) {
      const batch = prompts.slice(i, i + BATCH)
      const promptList = batch.map((p, idx) => `${idx + 1}. "${p.text}"`).join('\n')

      try {
        const res = await withTimeout(anthropic.messages.create({
          model: MODELS.sonnet,
          max_tokens: 2000,
          system: `You are a GEO (Generative Engine Optimization) auditor. For each tracked prompt, evaluate whether the client's website content would give AI models enough information to recommend this business. Be ruthlessly specific.

Return ONLY valid JSON:
{"audits":[{
  "prompt": "the prompt text",
  "score": 1-10 (10 = website perfectly answers this, 1 = no relevant content at all),
  "found_on_page": "URL of the page that best addresses this, or null",
  "whats_missing": "Specific content that should exist but doesn't. Be concrete — name exact topics, pages, or sections needed.",
  "fix": "One specific action to fix this gap"
}]}`,
          messages: [{
            role: 'user',
            content: `BUSINESS: ${clientContext}\nDomain: ${client.domain}\n\nTRACKED PROMPTS:\n${promptList}\n\nWEBSITE CONTENT:\n${websiteContent.slice(0, 5000)}`,
          }],
        }), 25000)

        const text = res.content[0].type === 'text' ? res.content[0].text : ''
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          const parsed = JSON.parse(match[0])
          if (Array.isArray(parsed.audits)) {
            for (const audit of parsed.audits) {
              const prompt = batch.find((p) => audit.prompt?.includes(p.text.slice(0, 30)))
              auditResults.push({
                prompt_id: prompt?.id || null,
                prompt_text: audit.prompt || '',
                score: audit.score || 0,
                found_on_page: audit.found_on_page || null,
                whats_missing: audit.whats_missing || '',
                fix: audit.fix || '',
              })
            }
          }
        }
      } catch (e: any) {
        console.error('GEO audit batch failed:', e)
        // Add failed prompts with score 0
        for (const p of batch) {
          auditResults.push({
            prompt_id: p.id,
            prompt_text: p.text,
            score: 0,
            found_on_page: null,
            whats_missing: 'Audit failed — try again',
            fix: '',
          })
        }
      }
    }

    const avgScore = auditResults.length > 0
      ? Math.round(auditResults.reduce((s, a) => s + a.score, 0) / auditResults.length * 10)
      : 0

    return NextResponse.json({
      pages_crawled: pages.length,
      prompts_audited: auditResults.length,
      avg_score: avgScore,
      audits: auditResults,
    })
  } catch (e: any) {
    console.error('GEO audit crashed:', e)
    return NextResponse.json({ error: e.message || 'Audit failed' }, { status: 500 })
  }
}
