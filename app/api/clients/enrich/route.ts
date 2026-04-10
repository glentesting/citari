import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { crawlCompetitorSitemap, fetchPageContent } from '@/lib/competitors/crawl'
import { generateCompetitorIntelligence } from '@/lib/competitors/intelligence'

export const maxDuration = 300

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

    // Get competitors that need enrichment (no intel_brief yet)
    const { data: competitors } = await admin.from('competitors')
      .select('id, name, domain')
      .eq('client_id', client_id)
      .is('intel_brief', null)

    if (!competitors || competitors.length === 0) {
      return NextResponse.json({ message: 'No competitors need enrichment' })
    }

    console.log(`Enriching ${competitors.length} competitors for ${client.name}`)
    const results: string[] = []
    const BATCH_SIZE = 3

    for (const comp of competitors) {
      // ── Crawl competitor website ──
      try {
        if (comp.domain) {
          const urls = await crawlCompetitorSitemap(comp.domain)
          if (urls.length === 0) {
            const homepage = await fetchPageContent(`https://${comp.domain}`)
            if (homepage) urls.push(homepage.url)
          }

          const pages = []
          for (let i = 0; i < urls.length; i += BATCH_SIZE) {
            const batch = urls.slice(i, i + BATCH_SIZE)
            const batchResults = await Promise.all(
              batch.map((url) => fetchPageContent(url).catch(() => null))
            )
            for (const content of batchResults) {
              if (content) pages.push(content)
            }
          }

          if (pages.length > 0) {
            const contentRows = pages.map((page) => ({
              competitor_id: comp.id,
              url: page.url,
              title: page.title,
              excerpt: page.excerpt.slice(0, 2000),
              likely_cited: false,
              citation_prompt_ids: [] as string[],
            }))
            await admin.from('competitor_content').delete().eq('competitor_id', comp.id)
            await admin.from('competitor_content').insert(contentRows)
          }
        }
      } catch (e: any) {
        console.error(`Crawl failed for ${comp.name}:`, e)
      }

      // ── Run intelligence analysis ──
      try {
        const { data: content } = await admin.from('competitor_content')
          .select('title, excerpt')
          .eq('competitor_id', comp.id)
          .limit(10)

        // Pull scan data showing where this competitor appears
        const { data: scans } = await admin.from('scan_results')
          .select('response_excerpt, competitor_mentions, mentioned, prompt_id')
          .eq('client_id', client_id)
          .order('scanned_at', { ascending: false })
          .limit(100)

        const { data: prompts } = await admin.from('prompts')
          .select('id, text')
          .eq('client_id', client_id)

        const promptMap = new Map((prompts || []).map((p) => [p.id, p.text]))

        const compScans = (scans || []).filter(
          (s: any) => s.competitor_mentions?.includes(comp.name)
        )
        const clientMissedPrompts = compScans
          .filter((s: any) => !s.mentioned)
          .map((s: any) => promptMap.get(s.prompt_id))
          .filter(Boolean)

        const scanContext = compScans.length > 0
          ? `Competitor appears in ${compScans.length}/${(scans || []).length} scanned responses.\n` +
            `Client NOT mentioned in ${compScans.filter((s: any) => !s.mentioned).length} of those.\n` +
            (clientMissedPrompts.length > 0
              ? `Prompts where competitor wins and client is absent:\n${clientMissedPrompts.slice(0, 5).map((p) => `- "${p}"`).join('\n')}`
              : '')
          : undefined

        const intel = await generateCompetitorIntelligence(
          client,
          { name: comp.name, domain: comp.domain },
          content || [],
          scanContext
        )

        await admin.from('competitors').update({
          intel_brief: intel.intel_brief,
          why_winning: intel.why_winning,
          content_gaps: intel.content_gaps,
          visibility_score: intel.visibility_score,
        }).eq('id', comp.id)

        results.push(`${comp.name}: done`)
      } catch (e: any) {
        console.error(`Intel failed for ${comp.name}:`, e)
        results.push(`${comp.name}: failed`)
      }
    }

    console.log('Enrich complete:', results)
    return NextResponse.json({ enriched: results.length, results })
  } catch (e: any) {
    console.error('Enrich route crashed:', e)
    return NextResponse.json({ error: e.message || 'Enrich failed' }, { status: 500 })
  }
}
