import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { crawlCompetitorSitemap, fetchPageContent } from '@/lib/competitors/crawl'

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

  const { competitor_id } = await request.json()
  if (!competitor_id) {
    return NextResponse.json({ error: 'competitor_id is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch competitor
  const { data: competitor } = await adminSupabase
    .from('competitors')
    .select('id, name, domain, client_id')
    .eq('id', competitor_id)
    .single()

  if (!competitor || !competitor.domain) {
    return NextResponse.json({ error: 'Competitor not found or has no domain' }, { status: 404 })
  }

  // Crawl sitemap
  const urls = await crawlCompetitorSitemap(competitor.domain)

  if (urls.length === 0) {
    return NextResponse.json({ error: 'No content URLs found in sitemap' }, { status: 404 })
  }

  // Fetch page content (rate-limited: sequential with small delay)
  const pages = []
  for (const url of urls) {
    const content = await fetchPageContent(url)
    if (content) {
      pages.push(content)
    }
    // Small delay to be polite
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  // Fetch scan results to cross-reference which content might be cited
  const { data: scans } = await adminSupabase
    .from('scan_results')
    .select('prompt_id, response_excerpt, competitor_mentions')
    .eq('client_id', competitor.client_id)
    .order('scanned_at', { ascending: false })
    .limit(200)

  const scanResults = scans || []

  // For each page, check if any scan response excerpts mention content from this page
  const contentRows = pages.map((page) => {
    const titleLower = page.title.toLowerCase()
    const titleWords = titleLower.split(' ').filter((w) => w.length > 4).slice(0, 5)

    // Check if the page title keywords appear in any scan response that also mentions this competitor
    const matchingPromptIds: string[] = []
    let likelyCited = false

    for (const scan of scanResults) {
      if (!scan.response_excerpt) continue
      const excerpt = scan.response_excerpt.toLowerCase()

      // Check if the competitor is mentioned and if title keywords match
      const competitorMentioned = scan.competitor_mentions?.includes(competitor.name)
      if (competitorMentioned) {
        const keywordMatches = titleWords.filter((w) => excerpt.includes(w)).length
        if (keywordMatches >= 2) {
          likelyCited = true
          if (!matchingPromptIds.includes(scan.prompt_id)) {
            matchingPromptIds.push(scan.prompt_id)
          }
        }
      }
    }

    return {
      competitor_id: competitor.id,
      url: page.url,
      title: page.title,
      excerpt: page.excerpt.slice(0, 2000),
      likely_cited: likelyCited,
      citation_prompt_ids: matchingPromptIds,
    }
  })

  // Delete old crawl data for this competitor
  await adminSupabase
    .from('competitor_content')
    .delete()
    .eq('competitor_id', competitor.id)

  // Insert new data
  if (contentRows.length > 0) {
    const { error: insertError } = await adminSupabase
      .from('competitor_content')
      .insert(contentRows)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    pages_crawled: contentRows.length,
    likely_cited: contentRows.filter((r) => r.likely_cited).length,
  })
}
