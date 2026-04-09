const SERPER_API_URL = 'https://google.serper.dev/search'

export interface BacklinkOpportunity {
  source_domain: string
  source_url: string | null
  opportunity_type: 'guest_post' | 'resource_page' | 'broken_link' | 'mention' | 'directory'
  relevance_score: number // 1-10
  links_to_competitors: string[]
}

/**
 * Discover backlink opportunities by finding domains that link to competitors but not to the client.
 */
export async function discoverBacklinkOpportunities(
  clientDomain: string,
  competitorDomains: string[],
  industry: string | null
): Promise<BacklinkOpportunity[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) return []

  const opportunities: BacklinkOpportunity[] = []
  const seenDomains = new Set<string>()

  // Search for competitor backlinks
  for (const compDomain of competitorDomains.slice(0, 3)) {
    const queries = [
      `"${compDomain}" -site:${compDomain}`,
      industry ? `${industry} resources links ${compDomain}` : null,
    ].filter(Boolean)

    for (const q of queries) {
      try {
        const res = await fetch(SERPER_API_URL, {
          method: 'POST',
          headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, gl: 'us', hl: 'en', num: 10 }),
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) continue
        const data = await res.json()

        for (const result of data.organic || []) {
          const domain = (result.link || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0]

          // Skip if it's the client domain, a competitor domain, or already seen
          if (!domain || domain.includes(clientDomain.replace('www.', '')) || seenDomains.has(domain)) continue
          if (competitorDomains.some((cd) => domain.includes(cd.replace('www.', '')))) continue

          seenDomains.add(domain)

          const url = result.link || ''
          const title = (result.title || '').toLowerCase()
          const snippet = (result.snippet || '').toLowerCase()

          let type: BacklinkOpportunity['opportunity_type'] = 'mention'
          if (title.includes('resource') || title.includes('links') || title.includes('tools')) {
            type = 'resource_page'
          } else if (title.includes('guest') || title.includes('contribute') || title.includes('write for')) {
            type = 'guest_post'
          } else if (snippet.includes('directory') || snippet.includes('listing')) {
            type = 'directory'
          }

          // Simple relevance score based on how many competitors this domain links to
          const linksTo = competitorDomains.filter((cd) =>
            snippet.includes(cd.replace('www.', '')) || title.includes(cd.replace('www.', ''))
          )

          opportunities.push({
            source_domain: domain,
            source_url: url,
            opportunity_type: type,
            relevance_score: Math.min(10, 5 + linksTo.length * 2),
            links_to_competitors: linksTo,
          })
        }
      } catch {
        continue
      }
    }
  }

  // Sort by relevance
  return opportunities
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 20)
}
